package com.hedgelab.v2.service.budget;

import com.hedgelab.v2.entity.budget.BudgetForecastHistory;
import com.hedgelab.v2.entity.budget.BudgetLineItem;
import com.hedgelab.v2.entity.budget.BudgetLineItemComponent;
import com.hedgelab.v2.entity.budget.BudgetPeriod;
import com.hedgelab.v2.entity.budget.BudgetVersion;
import com.hedgelab.v2.entity.kernel.Commodity;
import com.hedgelab.v2.entity.kernel.Site;
import com.hedgelab.v2.exception.InvalidStateException;
import com.hedgelab.v2.exception.ResourceNotFoundException;
import com.hedgelab.v2.repository.budget.BudgetComponentRepository;
import com.hedgelab.v2.repository.budget.BudgetForecastHistoryRepository;
import com.hedgelab.v2.repository.budget.BudgetLineItemRepository;
import com.hedgelab.v2.repository.budget.BudgetPeriodRepository;
import com.hedgelab.v2.repository.budget.BudgetVersionRepository;
import com.hedgelab.v2.repository.kernel.CommodityRepository;
import com.hedgelab.v2.repository.kernel.SiteRepository;
import com.hedgelab.v2.service.kernel.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class BudgetService {

    private final BudgetPeriodRepository periodRepo;
    private final BudgetLineItemRepository lineItemRepo;
    private final BudgetVersionRepository versionRepo;
    private final BudgetComponentRepository componentRepo;
    private final BudgetForecastHistoryRepository forecastHistoryRepo;
    private final SiteRepository siteRepo;
    private final CommodityRepository commodityRepo;
    private final AuditService auditService;

    // ---- Periods ----

    public List<BudgetPeriod> listPeriods(UUID orgId, UUID siteId, String commodityId,
                                           Integer budgetYear, String status) {
        List<BudgetPeriod> periods = periodRepo.findFiltered(orgId, siteId, commodityId, budgetYear, status);
        periods.forEach(this::populateJoinedFields);
        return periods;
    }

    public BudgetPeriod getPeriod(UUID periodId) {
        BudgetPeriod period = periodRepo.findById(periodId)
                .orElseThrow(() -> new ResourceNotFoundException("BudgetPeriod", periodId));
        List<BudgetLineItem> items = lineItemRepo.findByPeriodIdOrderByBudgetMonth(periodId);

        // Load components and compute transient fields for each line item
        BigDecimal bushelsPerMt = getBushelsPerMt(period.getCommodityId());
        for (BudgetLineItem li : items) {
            List<BudgetLineItemComponent> components = componentRepo.findByLineItemIdOrderByDisplayOrder(li.getId());
            li.setComponents(components);
            li.setTargetAllInPrice(computeAllInPrice(components, bushelsPerMt));
            li.setOverHedged(isOverHedged(li));
            li.setTotalNotional(computeNotional(li));
        }

        period.setLineItems(items);
        populateJoinedFields(period);
        return period;
    }

    private BigDecimal getBushelsPerMt(String commodityId) {
        BigDecimal defaultVal = BigDecimal.valueOf(39.3683); // corn default
        if (commodityId == null) return defaultVal;
        return commodityRepo.findById(commodityId).map(c -> {
            if (c.getConfig() != null && c.getConfig().containsKey("bushelsPerMt")) {
                return new BigDecimal(c.getConfig().get("bushelsPerMt").toString());
            }
            // Derive from contract size for standard ag commodities: 5000 bu / ~127 MT
            return defaultVal;
        }).orElse(defaultVal);
    }

    private boolean isOverHedged(BudgetLineItem li) {
        BigDecimal effectiveVolume = li.getForecastVolume() != null
                ? li.getForecastVolume() : li.getBudgetedVolume();
        if (effectiveVolume.compareTo(BigDecimal.ZERO) <= 0) return false;
        BigDecimal totalCovered = li.getCommittedVolume().add(li.getHedgedVolume());
        return totalCovered.compareTo(effectiveVolume) > 0;
    }

    private BigDecimal computeNotional(BudgetLineItem li) {
        if (li.getTargetAllInPrice() != null && li.getTargetAllInPrice().compareTo(BigDecimal.ZERO) > 0) {
            return li.getBudgetedVolume().multiply(li.getTargetAllInPrice());
        }
        if (li.getBudgetPrice() != null) {
            return li.getBudgetedVolume().multiply(li.getBudgetPrice());
        }
        return BigDecimal.ZERO;
    }

    private void populateJoinedFields(BudgetPeriod period) {
        siteRepo.findById(period.getSiteId()).ifPresent(site -> {
            period.setSiteName(site.getName());
            period.setSiteCode(site.getCode());
        });
        commodityRepo.findById(period.getCommodityId()).ifPresent(commodity -> {
            period.setCommodityName(commodity.getName());
        });
    }

    @Transactional
    public BudgetPeriod createPeriod(BudgetPeriod period) {
        period.setStatus("draft");
        BudgetPeriod saved = periodRepo.save(period);
        auditService.log(period.getOrgId(), null, "budget", "period",
                saved.getId().toString(), "create", null, null, "api", null);
        populateJoinedFields(saved);
        return saved;
    }

    @Transactional
    public BudgetPeriod updatePeriodNotes(UUID periodId, String notes) {
        BudgetPeriod period = getPeriod(periodId);
        period.setNotes(notes);
        period.setUpdatedAt(Instant.now());
        return periodRepo.save(period);
    }

    // ---- Line Items ----

    @Transactional
    public BudgetLineItem upsertLineItem(UUID periodId, BudgetLineItem data, UUID userId) {
        return upsertLineItem(periodId, data, userId, null, null);
    }

    @Transactional
    public BudgetLineItem upsertLineItem(UUID periodId, BudgetLineItem data, UUID userId,
                                          List<BudgetLineItemComponent> components, String forecastNote) {
        BudgetPeriod period = periodRepo.findById(periodId)
                .orElseThrow(() -> new ResourceNotFoundException("BudgetPeriod", periodId));
        if (period.getLockedAt() != null) {
            throw new InvalidStateException("Budget period is locked");
        }

        Optional<BudgetLineItem> existing = lineItemRepo.findByPeriodIdAndBudgetMonth(periodId, data.getBudgetMonth());
        BudgetLineItem saved;
        if (existing.isPresent()) {
            BudgetLineItem e = existing.get();
            boolean forecastChanged = false;
            if (data.getBudgetedVolume() != null) e.setBudgetedVolume(data.getBudgetedVolume());
            if (data.getBudgetPrice() != null) e.setBudgetPrice(data.getBudgetPrice());
            if (data.getCommittedVolume() != null) e.setCommittedVolume(data.getCommittedVolume());
            if (data.getCommittedAvgPrice() != null) e.setCommittedAvgPrice(data.getCommittedAvgPrice());
            if (data.getCommittedCost() != null) e.setCommittedCost(data.getCommittedCost());
            if (data.getHedgedVolume() != null) e.setHedgedVolume(data.getHedgedVolume());
            if (data.getHedgedAvgPrice() != null) e.setHedgedAvgPrice(data.getHedgedAvgPrice());
            if (data.getHedgedCost() != null) e.setHedgedCost(data.getHedgedCost());
            if (data.getForecastVolume() != null) {
                if (!data.getForecastVolume().equals(e.getForecastVolume())) forecastChanged = true;
                e.setForecastVolume(data.getForecastVolume());
            }
            if (data.getForecastPrice() != null) {
                if (!data.getForecastPrice().equals(e.getForecastPrice())) forecastChanged = true;
                e.setForecastPrice(data.getForecastPrice());
            }
            if (data.getFuturesMonth() != null) e.setFuturesMonth(data.getFuturesMonth());
            if (data.getNotes() != null) e.setNotes(data.getNotes());
            e.setUpdatedAt(Instant.now());
            saved = lineItemRepo.save(e);

            // Log forecast history if forecast changed
            if (forecastChanged) {
                logForecastChange(saved.getId(), saved.getForecastVolume(), saved.getForecastPrice(),
                        userId != null ? userId.toString() : null, forecastNote);
            }
        } else {
            data.setPeriodId(periodId);
            saved = lineItemRepo.save(data);

            // Log initial forecast if present
            if (data.getForecastVolume() != null || data.getForecastPrice() != null) {
                logForecastChange(saved.getId(), saved.getForecastVolume(), saved.getForecastPrice(),
                        userId != null ? userId.toString() : null, forecastNote);
            }
        }

        // Save components if provided
        if (components != null) {
            saveComponents(saved.getId(), components);
        }

        return saved;
    }

    @Transactional
    public List<BudgetLineItem> upsertLineItems(UUID periodId, List<BudgetLineItem> items, UUID userId) {
        return items.stream().map(item -> upsertLineItem(periodId, item, userId)).toList();
    }

    @Transactional
    public void deleteLineItem(UUID lineItemId, UUID userId) {
        BudgetLineItem item = lineItemRepo.findById(lineItemId)
                .orElseThrow(() -> new ResourceNotFoundException("BudgetLineItem", lineItemId));
        BudgetPeriod period = periodRepo.findById(item.getPeriodId())
                .orElseThrow(() -> new ResourceNotFoundException("BudgetPeriod", item.getPeriodId()));
        if (period.getLockedAt() != null) {
            throw new InvalidStateException("Budget period is locked");
        }
        lineItemRepo.deleteById(lineItemId);
    }

    // ---- Components ----

    @Transactional
    public List<BudgetLineItemComponent> saveComponents(UUID lineItemId, List<BudgetLineItemComponent> components) {
        componentRepo.deleteByLineItemId(lineItemId);
        for (int i = 0; i < components.size(); i++) {
            BudgetLineItemComponent c = components.get(i);
            c.setLineItemId(lineItemId);
            c.setDisplayOrder(i);
        }
        return componentRepo.saveAll(components);
    }

    public List<BudgetLineItemComponent> getComponents(UUID lineItemId) {
        return componentRepo.findByLineItemIdOrderByDisplayOrder(lineItemId);
    }

    public BigDecimal computeAllInPrice(List<BudgetLineItemComponent> components, BigDecimal bushelsPerMt) {
        if (components == null || components.isEmpty()) return BigDecimal.ZERO;
        BigDecimal total = BigDecimal.ZERO;
        for (BudgetLineItemComponent c : components) {
            BigDecimal val = c.getTargetValue();
            switch (c.getUnit()) {
                case "$/bu" -> total = total.add(val);
                case "$/MT" -> {
                    if (bushelsPerMt.compareTo(BigDecimal.ZERO) > 0) {
                        total = total.add(val.divide(bushelsPerMt, 6, RoundingMode.HALF_UP));
                    }
                }
                case "%" -> {
                    // percentage applied to running total
                    total = total.add(total.multiply(val).divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
                }
                default -> total = total.add(val);
            }
        }
        return total.setScale(4, RoundingMode.HALF_UP);
    }

    // ---- Forecast History ----

    public List<BudgetForecastHistory> getForecastHistory(UUID lineItemId) {
        return forecastHistoryRepo.findByLineItemIdOrderByRecordedAtDesc(lineItemId);
    }

    @Transactional
    public BudgetForecastHistory logForecastChange(UUID lineItemId, BigDecimal volume, BigDecimal price,
                                                     String recordedBy, String notes) {
        BudgetForecastHistory entry = BudgetForecastHistory.builder()
                .lineItemId(lineItemId)
                .forecastVolume(volume)
                .forecastPrice(price)
                .recordedBy(recordedBy)
                .notes(notes)
                .build();
        return forecastHistoryRepo.save(entry);
    }

    @Transactional
    public List<BudgetLineItem> batchForecastUpdate(UUID periodId, List<BudgetLineItem> updates,
                                                      String note, UUID userId) {
        List<BudgetLineItem> results = new ArrayList<>();
        for (BudgetLineItem data : updates) {
            BudgetLineItem result = upsertLineItem(periodId, data, userId, null, note);
            results.add(result);
        }
        return results;
    }

    // ---- Workflow ----

    @Transactional
    public BudgetPeriod submitBudget(UUID periodId, UUID userId) {
        BudgetPeriod period = getPeriod(periodId);
        if (!"draft".equals(period.getStatus())) {
            throw new InvalidStateException("Can only submit from draft status, current: " + period.getStatus());
        }
        period.setStatus("submitted");
        period.setUpdatedAt(Instant.now());
        auditService.log(period.getOrgId(), userId, "budget", "period",
                periodId.toString(), "submit", null, null, "api", null);
        return periodRepo.save(period);
    }

    @Transactional
    public BudgetPeriod approveBudget(UUID periodId, UUID userId) {
        BudgetPeriod period = getPeriod(periodId);
        if (!"submitted".equals(period.getStatus())) {
            throw new InvalidStateException("Can only approve from submitted status, current: " + period.getStatus());
        }
        period.setStatus("approved");
        period.setApprovedBy(userId);
        period.setApprovedAt(Instant.now());
        period.setUpdatedAt(Instant.now());
        auditService.log(period.getOrgId(), userId, "budget", "period",
                periodId.toString(), "approve", null, null, "api", null);
        return periodRepo.save(period);
    }

    @Transactional
    public BudgetPeriod lockBudget(UUID periodId, UUID userId) {
        BudgetPeriod period = getPeriod(periodId);
        period.setLockedAt(Instant.now());
        period.setUpdatedAt(Instant.now());
        auditService.log(period.getOrgId(), userId, "budget", "period",
                periodId.toString(), "lock", null, null, "api", null);
        return periodRepo.save(period);
    }

    @Transactional
    public BudgetPeriod unlockBudget(UUID periodId, UUID userId) {
        BudgetPeriod period = getPeriod(periodId);
        period.setLockedAt(null);
        period.setUpdatedAt(Instant.now());
        auditService.log(period.getOrgId(), userId, "budget", "period",
                periodId.toString(), "unlock", null, null, "api", null);
        return periodRepo.save(period);
    }

    // ---- Versions ----

    @Transactional
    public BudgetVersion createVersionSnapshot(UUID periodId, UUID userId, String name) {
        List<BudgetLineItem> items = lineItemRepo.findByPeriodIdOrderByBudgetMonth(periodId);
        int nextVersion = versionRepo.findMaxVersionNumber(periodId) + 1;

        BudgetVersion version = BudgetVersion.builder()
                .periodId(periodId)
                .versionNumber(nextVersion)
                .versionName(name != null ? name : "v" + nextVersion)
                .snapshot(items)
                .createdBy(userId)
                .build();
        return versionRepo.save(version);
    }

    public List<BudgetVersion> getVersionHistory(UUID periodId) {
        return versionRepo.findByPeriodIdOrderByVersionNumberDesc(periodId);
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public List<BudgetLineItem> restoreVersion(UUID periodId, int versionNumber, UUID userId) {
        BudgetVersion version = versionRepo.findByPeriodIdAndVersionNumber(periodId, versionNumber)
                .orElseThrow(() -> new ResourceNotFoundException("BudgetVersion", versionNumber));

        BudgetPeriod period = periodRepo.findById(periodId)
                .orElseThrow(() -> new ResourceNotFoundException("BudgetPeriod", periodId));
        if (period.getLockedAt() != null) {
            throw new InvalidStateException("Budget period is locked");
        }

        // Delete current line items and restore from snapshot
        lineItemRepo.deleteByPeriodId(periodId);

        List<Map<String, Object>> snapshot = (List<Map<String, Object>>) version.getSnapshot();
        List<BudgetLineItem> restored = new ArrayList<>();
        for (Map<String, Object> item : snapshot) {
            BudgetLineItem li = BudgetLineItem.builder()
                    .periodId(periodId)
                    .budgetMonth((String) item.get("budgetMonth"))
                    .budgetedVolume(toBigDecimal(item.get("budgetedVolume")))
                    .budgetPrice(toBigDecimal(item.get("budgetPrice")))
                    .committedVolume(toBigDecimal(item.get("committedVolume")))
                    .committedAvgPrice(toBigDecimal(item.get("committedAvgPrice")))
                    .committedCost(toBigDecimal(item.get("committedCost")))
                    .hedgedVolume(toBigDecimal(item.get("hedgedVolume")))
                    .hedgedAvgPrice(toBigDecimal(item.get("hedgedAvgPrice")))
                    .hedgedCost(toBigDecimal(item.get("hedgedCost")))
                    .forecastVolume(toBigDecimal(item.get("forecastVolume")))
                    .forecastPrice(toBigDecimal(item.get("forecastPrice")))
                    .notes((String) item.get("notes"))
                    .build();
            restored.add(lineItemRepo.save(li));
        }

        auditService.log(period.getOrgId(), userId, "budget", "period",
                periodId.toString(), "restore", null, Map.of("versionNumber", versionNumber), "api", null);

        return restored;
    }

    // ---- Coverage ----

    public Map<String, Object> getCoverageSummary(UUID orgId, String commodityId, String siteId) {
        List<Object[]> rows = lineItemRepo.getCoverageSummary(orgId, commodityId, siteId);

        BigDecimal totalBudgeted = BigDecimal.ZERO;
        BigDecimal totalCommitted = BigDecimal.ZERO;
        BigDecimal totalHedged = BigDecimal.ZERO;
        BigDecimal totalOpen = BigDecimal.ZERO;
        List<Map<String, Object>> byMonth = new ArrayList<>();

        for (Object[] row : rows) {
            String month = (String) row[0];
            BigDecimal budgeted = toBigDecimal(row[1]);
            BigDecimal committed = toBigDecimal(row[2]);
            BigDecimal hedged = toBigDecimal(row[3]);
            BigDecimal open = toBigDecimal(row[4]);

            totalBudgeted = totalBudgeted.add(budgeted);
            totalCommitted = totalCommitted.add(committed);
            totalHedged = totalHedged.add(hedged);
            totalOpen = totalOpen.add(open);

            Map<String, Object> monthData = new LinkedHashMap<>();
            monthData.put("month", month);
            monthData.put("budgeted", budgeted);
            monthData.put("committed", committed);
            monthData.put("hedged", hedged);
            monthData.put("open", open);
            byMonth.add(monthData);
        }

        BigDecimal overallPct = totalBudgeted.compareTo(BigDecimal.ZERO) > 0
                ? totalCommitted.add(totalHedged).multiply(BigDecimal.valueOf(100))
                  .divide(totalBudgeted, 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalBudgeted", totalBudgeted);
        result.put("totalCommitted", totalCommitted);
        result.put("totalHedged", totalHedged);
        result.put("totalOpen", totalOpen);
        result.put("overallCoveragePct", overallPct);
        result.put("byMonth", byMonth);
        return result;
    }

    private BigDecimal toBigDecimal(Object val) {
        if (val == null) return BigDecimal.ZERO;
        if (val instanceof BigDecimal bd) return bd;
        return new BigDecimal(val.toString());
    }
}
