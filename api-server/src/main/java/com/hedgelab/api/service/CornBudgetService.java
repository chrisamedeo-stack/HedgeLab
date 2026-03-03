package com.hedgelab.api.service;

import com.hedgelab.api.dto.CommoditySpec;
import com.hedgelab.api.dto.request.BatchForecastUpdateRequest;
import com.hedgelab.api.dto.request.SaveBudgetLineRequest;
import com.hedgelab.api.dto.response.CornBudgetLineResponse;
import com.hedgelab.api.dto.response.CornBudgetLineResponse.ComponentDto;
import com.hedgelab.api.dto.response.CornBudgetLineResponse.ForecastHistoryDto;
import com.hedgelab.api.entity.CornBudgetComponent;
import com.hedgelab.api.entity.CornBudgetLine;
import com.hedgelab.api.entity.CornForecastHistory;
import com.hedgelab.api.entity.HedgeAllocation;
import com.hedgelab.api.entity.Site;
import com.hedgelab.api.repository.CornBudgetLineRepository;
import com.hedgelab.api.repository.CornForecastHistoryRepository;
import com.hedgelab.api.repository.HedgeAllocationRepository;
import com.hedgelab.api.repository.SiteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CornBudgetService {

    private final CornBudgetLineRepository      budgetRepo;
    private final SiteRepository                 siteRepo;
    private final AppSettingService              appSettingService;
    private final HedgeAllocationRepository      allocationRepo;
    private final CornForecastHistoryRepository  forecastHistoryRepo;
    private final CommoditySpecService           specService;

    // ─── Queries ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CornBudgetLineResponse> getAll(String commodityCode, String siteCode, String cropYear, String fiscalYear) {
        CommoditySpec spec = specService.getSpec(commodityCode);
        BigDecimal bushelsPerMt = spec.bushelsPerMt();
        BigDecimal bushelsPerLot = BigDecimal.valueOf(spec.contractSizeBu());

        // fiscalYear takes priority; fall back to cropYear for backward compat
        String fy = (fiscalYear != null && !fiscalYear.isBlank()) ? fiscalYear : cropYear;
        List<CornBudgetLine> lines;
        if (siteCode != null && fy != null) {
            lines = budgetRepo.findBySiteCodeAndCropYearOrderByBudgetMonthAsc(siteCode, fy);
        } else if (siteCode != null) {
            lines = budgetRepo.findBySiteCodeOrderByBudgetMonthAsc(siteCode);
        } else if (fy != null) {
            lines = budgetRepo.findByCropYearOrderBySiteCodeAscBudgetMonthAsc(fy);
        } else {
            lines = budgetRepo.findAllByOrderBySiteCodeAscBudgetMonthAsc();
        }

        // Filter by commodity code
        lines = lines.stream()
                .filter(l -> l.getCommodityCode() != null && l.getCommodityCode().startsWith(spec.code()))
                .collect(Collectors.toList());

        // Pre-load hedged volumes to avoid N+1
        Map<String, BigDecimal> hedgedMap = buildHedgedMap(lines, bushelsPerMt, bushelsPerLot, spec.futuresPrefix());

        return lines.stream()
                .map(l -> toResponse(l, hedgedMap, bushelsPerMt))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CornBudgetLineResponse getById(Long id) {
        CornBudgetLine line = findOrThrow(id);
        CommoditySpec spec = resolveSpecFromBudgetLine(line);
        BigDecimal bushelsPerMt = spec.bushelsPerMt();
        BigDecimal bushelsPerLot = BigDecimal.valueOf(spec.contractSizeBu());
        Map<String, BigDecimal> hedgedMap = buildHedgedMap(List.of(line), bushelsPerMt, bushelsPerLot, spec.futuresPrefix());
        return toResponse(line, hedgedMap, bushelsPerMt);
    }

    @Transactional(readOnly = true)
    public List<ForecastHistoryDto> getForecastHistory(Long budgetLineId) {
        findOrThrow(budgetLineId); // ensure exists
        return forecastHistoryRepo.findByBudgetLineIdOrderByRecordedAtDesc(budgetLineId)
                .stream()
                .map(h -> ForecastHistoryDto.builder()
                        .id(h.getId())
                        .forecastMt(h.getForecastMt())
                        .forecastBu(h.getForecastBu())
                        .recordedAt(h.getRecordedAt())
                        .recordedBy(h.getRecordedBy())
                        .notes(h.getNotes())
                        .build())
                .collect(Collectors.toList());
    }

    // ─── Mutations ────────────────────────────────────────────────────────────

    @Transactional
    public CornBudgetLineResponse create(String commodityCode, SaveBudgetLineRequest req) {
        CommoditySpec spec = specService.getSpec(commodityCode);
        BigDecimal bushelsPerMt = spec.bushelsPerMt();
        BigDecimal bushelsPerLot = BigDecimal.valueOf(spec.contractSizeBu());

        Site site = siteRepo.findByCode(req.getSiteCode())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Site not found: " + req.getSiteCode()));

        // Derive missing volume unit from the other
        BigDecimal bu = req.getBudgetVolumeBu();
        BigDecimal mt = req.getBudgetVolumeMt();
        if (bu != null && mt == null) {
            mt = bu.divide(bushelsPerMt, 4, RoundingMode.HALF_UP);
        } else if (mt != null && bu == null) {
            bu = mt.multiply(bushelsPerMt).setScale(2, RoundingMode.HALF_UP);
        }

        // Derive forecast units
        BigDecimal forecastMt = req.getForecastVolumeMt();
        BigDecimal forecastBu = req.getForecastVolumeBu();
        if (forecastMt != null && forecastBu == null) {
            forecastBu = forecastMt.multiply(bushelsPerMt).setScale(2, RoundingMode.HALF_UP);
        } else if (forecastBu != null && forecastMt == null) {
            forecastMt = forecastBu.divide(bushelsPerMt, 4, RoundingMode.HALF_UP);
        }

        String explicitFy = req.getFiscalYear() != null ? req.getFiscalYear() : req.getCropYear();
        CornBudgetLine line = CornBudgetLine.builder()
                .site(site)
                .commodityCode(req.getCommodityCode() != null ? req.getCommodityCode() : spec.code())
                .budgetMonth(req.getBudgetMonth())
                .futuresMonth(req.getFuturesMonth())
                .budgetVolumeMt(mt)
                .budgetVolumeBu(bu)
                .forecastVolumeMt(forecastMt)
                .forecastVolumeBu(forecastBu)
                .cropYear(resolveFiscalYear(req.getBudgetMonth(), explicitFy))
                .notes(req.getNotes())
                .build();

        applyComponents(line, req);
        CornBudgetLine saved = budgetRepo.save(line);

        // Log forecast history if forecast provided
        if (forecastMt != null) {
            logForecastHistory(saved, forecastMt, forecastBu, req.getForecastNotes());
        }

        Map<String, BigDecimal> hedgedMap = buildHedgedMap(List.of(saved), bushelsPerMt, bushelsPerLot, spec.futuresPrefix());
        return toResponse(saved, hedgedMap, bushelsPerMt);
    }

    @Transactional
    public CornBudgetLineResponse update(Long id, SaveBudgetLineRequest req) {
        CornBudgetLine line = findOrThrow(id);
        CommoditySpec spec = resolveSpecFromBudgetLine(line);
        BigDecimal bushelsPerMt = spec.bushelsPerMt();
        BigDecimal bushelsPerLot = BigDecimal.valueOf(spec.contractSizeBu());

        if (req.getSiteCode() != null) {
            Site site = siteRepo.findByCode(req.getSiteCode())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Site not found: " + req.getSiteCode()));
            line.setSite(site);
        }
        if (req.getCommodityCode() != null) line.setCommodityCode(req.getCommodityCode());
        if (req.getBudgetMonth()   != null) line.setBudgetMonth(req.getBudgetMonth());
        if (req.getFuturesMonth()  != null) line.setFuturesMonth(req.getFuturesMonth());

        // Volume: derive missing unit from the other when either is supplied
        BigDecimal bu = req.getBudgetVolumeBu();
        BigDecimal mt = req.getBudgetVolumeMt();
        if (bu != null && mt == null) {
            mt = bu.divide(bushelsPerMt, 4, RoundingMode.HALF_UP);
        } else if (mt != null && bu == null) {
            bu = mt.multiply(bushelsPerMt).setScale(2, RoundingMode.HALF_UP);
        }
        if (mt != null) line.setBudgetVolumeMt(mt);
        if (bu != null) line.setBudgetVolumeBu(bu);

        // Forecast: derive missing unit, only log history if changed
        BigDecimal forecastMt = req.getForecastVolumeMt();
        BigDecimal forecastBu = req.getForecastVolumeBu();
        if (forecastMt != null && forecastBu == null) {
            forecastBu = forecastMt.multiply(bushelsPerMt).setScale(2, RoundingMode.HALF_UP);
        } else if (forecastBu != null && forecastMt == null) {
            forecastMt = forecastBu.divide(bushelsPerMt, 4, RoundingMode.HALF_UP);
        }
        if (forecastMt != null) {
            boolean changed = line.getForecastVolumeMt() == null
                    || line.getForecastVolumeMt().compareTo(forecastMt) != 0;
            line.setForecastVolumeMt(forecastMt);
            line.setForecastVolumeBu(forecastBu);
            if (changed) {
                logForecastHistory(line, forecastMt, forecastBu, req.getForecastNotes());
            }
        }

        if (req.getNotes() != null) line.setNotes(req.getNotes());

        String explicitFy = req.getFiscalYear() != null ? req.getFiscalYear() : req.getCropYear();
        String monthForFy = req.getBudgetMonth() != null ? req.getBudgetMonth() : line.getBudgetMonth();
        line.setCropYear(resolveFiscalYear(monthForFy, explicitFy));

        if (req.getComponents() != null) {
            line.getComponents().clear();
            applyComponents(line, req);
        }

        CornBudgetLine saved = budgetRepo.save(line);
        Map<String, BigDecimal> hedgedMap = buildHedgedMap(List.of(saved), bushelsPerMt, bushelsPerLot, spec.futuresPrefix());
        return toResponse(saved, hedgedMap, bushelsPerMt);
    }

    @Transactional
    public List<CornBudgetLineResponse> batchForecastUpdate(String commodityCode, BatchForecastUpdateRequest req) {
        CommoditySpec spec = specService.getSpec(commodityCode);
        BigDecimal bushelsPerMt = spec.bushelsPerMt();
        BigDecimal bushelsPerLot = BigDecimal.valueOf(spec.contractSizeBu());
        Instant now = Instant.now();
        List<CornBudgetLine> updated = new ArrayList<>();

        for (var upd : req.getUpdates()) {
            CornBudgetLine line = findOrThrow(upd.getBudgetLineId());
            BigDecimal forecastMt = upd.getForecastVolumeMt();
            BigDecimal forecastBu = forecastMt.multiply(bushelsPerMt).setScale(2, RoundingMode.HALF_UP);

            boolean changed = line.getForecastVolumeMt() == null
                    || line.getForecastVolumeMt().compareTo(forecastMt) != 0;

            line.setForecastVolumeMt(forecastMt);
            line.setForecastVolumeBu(forecastBu);
            budgetRepo.save(line);

            if (changed) {
                forecastHistoryRepo.save(CornForecastHistory.builder()
                        .budgetLine(line)
                        .forecastMt(forecastMt)
                        .forecastBu(forecastBu)
                        .recordedAt(now)
                        .notes(req.getNote())
                        .build());
            }
            updated.add(line);
        }

        Map<String, BigDecimal> hedgedMap = buildHedgedMap(updated, bushelsPerMt, bushelsPerLot, spec.futuresPrefix());
        return updated.stream()
                .map(l -> toResponse(l, hedgedMap, bushelsPerMt))
                .collect(Collectors.toList());
    }

    @Transactional
    public void delete(Long id) {
        budgetRepo.delete(findOrThrow(id));
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private CornBudgetLine findOrThrow(Long id) {
        return budgetRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Budget line not found: " + id));
    }

    private CommoditySpec resolveSpecFromBudgetLine(CornBudgetLine line) {
        String code = line.getCommodityCode();
        if (code == null || code.isBlank()) code = "CORN";
        // Handle legacy "CORN-ZC" format by taking the part before the dash
        if (code.contains("-")) code = code.split("-")[0];
        return specService.getSpec(code);
    }

    private void applyComponents(CornBudgetLine line, SaveBudgetLineRequest req) {
        if (req.getComponents() == null) return;
        List<CornBudgetComponent> components = new ArrayList<>();
        for (int i = 0; i < req.getComponents().size(); i++) {
            var dto = req.getComponents().get(i);
            components.add(CornBudgetComponent.builder()
                    .budgetLine(line)
                    .componentName(dto.getComponentName())
                    .unit(dto.getUnit() != null ? dto.getUnit() : "$/MT")
                    .targetValue(dto.getTargetValue())
                    .displayOrder(dto.getDisplayOrder() != null ? dto.getDisplayOrder() : i + 1)
                    .build());
        }
        line.getComponents().addAll(components);
    }

    private BigDecimal toUsdPerMt(BigDecimal value, String unit, BigDecimal bushelsPerMt) {
        if (value == null) return BigDecimal.ZERO;
        String u = unit != null ? unit.trim().toLowerCase() : "$/mt";
        if (u.equals("$/bu") || u.equals("usd/bu")) {
            return value.multiply(bushelsPerMt)
                        .setScale(4, RoundingMode.HALF_UP);
        }
        return value.setScale(4, RoundingMode.HALF_UP);
    }

    /**
     * Build a map of hedged MT keyed by "siteCode|budgetMonth" from hedge allocations.
     * Converts allocated lots to MT: lots × contractSizeBu / bushelsPerMt.
     */
    private Map<String, BigDecimal> buildHedgedMap(List<CornBudgetLine> lines,
                                                    BigDecimal bushelsPerMt, BigDecimal bushelsPerLot, String prefix) {
        Set<String> siteCodes = lines.stream()
                .map(l -> l.getSite().getCode())
                .collect(Collectors.toSet());

        if (siteCodes.isEmpty()) return Collections.emptyMap();

        Map<String, BigDecimal> hedgedMap = new HashMap<>();
        for (String sc : siteCodes) {
            List<HedgeAllocation> allocations = allocationRepo.findBySite_CodeOrderByBudgetMonthAsc(sc).stream()
                    .filter(a -> a.getHedgeTrade().getFuturesMonth() != null
                            && a.getHedgeTrade().getFuturesMonth().startsWith(prefix))
                    .collect(Collectors.toList());
            for (HedgeAllocation a : allocations) {
                String key = sc + "|" + a.getBudgetMonth();
                BigDecimal mt = bushelsPerLot
                        .multiply(BigDecimal.valueOf(a.getAllocatedLots()))
                        .divide(bushelsPerMt, 4, RoundingMode.HALF_UP);
                hedgedMap.merge(key, mt, BigDecimal::add);
            }
        }
        return hedgedMap;
    }

    private void logForecastHistory(CornBudgetLine line, BigDecimal forecastMt, BigDecimal forecastBu, String notes) {
        forecastHistoryRepo.save(CornForecastHistory.builder()
                .budgetLine(line)
                .forecastMt(forecastMt)
                .forecastBu(forecastBu)
                .recordedAt(Instant.now())
                .notes(notes)
                .build());
    }

    private CornBudgetLineResponse toResponse(CornBudgetLine line, Map<String, BigDecimal> hedgedMap,
                                               BigDecimal bushelsPerMt) {
        List<ComponentDto> compDtos = line.getComponents().stream().map(c -> {
            BigDecimal perMt = toUsdPerMt(c.getTargetValue(), c.getUnit(), bushelsPerMt);
            return ComponentDto.builder()
                    .id(c.getId())
                    .componentName(c.getComponentName())
                    .unit(c.getUnit())
                    .targetValue(c.getTargetValue())
                    .valuePerMt(perMt)
                    .displayOrder(c.getDisplayOrder())
                    .build();
        }).collect(Collectors.toList());

        BigDecimal allIn = compDtos.stream()
                .map(ComponentDto::getValuePerMt)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal targetAllInPerMt = allIn.compareTo(BigDecimal.ZERO) == 0 ? null : allIn;

        // Total notional spend = targetAllInPerMt × budgetVolumeMt
        BigDecimal totalNotionalSpend = null;
        if (targetAllInPerMt != null && line.getBudgetVolumeMt() != null) {
            totalNotionalSpend = targetAllInPerMt.multiply(line.getBudgetVolumeMt())
                    .setScale(2, RoundingMode.HALF_UP);
        }

        // Forecast variance = forecastMt − budgetMt
        BigDecimal forecastVarianceMt = null;
        if (line.getForecastVolumeMt() != null && line.getBudgetVolumeMt() != null) {
            forecastVarianceMt = line.getForecastVolumeMt().subtract(line.getBudgetVolumeMt())
                    .setScale(4, RoundingMode.HALF_UP);
        }

        // Hedged volume from pre-loaded map
        String hedgeKey = line.getSite().getCode() + "|" + line.getBudgetMonth();
        BigDecimal hedgedMt = hedgedMap.getOrDefault(hedgeKey, null);

        // Over-hedged: hedgedMt > (forecastMt ?? budgetMt)
        Boolean overHedged = null;
        if (hedgedMt != null) {
            BigDecimal reference = line.getForecastVolumeMt() != null
                    ? line.getForecastVolumeMt() : line.getBudgetVolumeMt();
            if (reference != null) {
                overHedged = hedgedMt.compareTo(reference) > 0;
            }
        }

        return CornBudgetLineResponse.builder()
                .id(line.getId())
                .siteCode(line.getSite().getCode())
                .siteName(line.getSite().getName())
                .commodityCode(line.getCommodityCode())
                .budgetMonth(line.getBudgetMonth())
                .futuresMonth(line.getFuturesMonth())
                .budgetVolumeMt(line.getBudgetVolumeMt())
                .budgetVolumeBu(line.getBudgetVolumeBu())
                .cropYear(line.getCropYear())
                .fiscalYear(line.getCropYear())
                .notes(line.getNotes())
                .targetAllInPerMt(targetAllInPerMt)
                .totalNotionalSpend(totalNotionalSpend)
                .forecastVolumeMt(line.getForecastVolumeMt())
                .forecastVolumeBu(line.getForecastVolumeBu())
                .forecastVarianceMt(forecastVarianceMt)
                .hedgedVolumeMt(hedgedMt)
                .overHedged(overHedged)
                .components(compDtos)
                .build();
    }

    /**
     * Derive fiscal year from budget month using configurable FY boundaries.
     */
    private String resolveFiscalYear(String budgetMonth, String explicitFiscalYear) {
        if (explicitFiscalYear != null && !explicitFiscalYear.isBlank()) return explicitFiscalYear;
        if (budgetMonth == null) return null;
        try {
            int year  = Integer.parseInt(budgetMonth.substring(0, 4));
            int month = Integer.parseInt(budgetMonth.substring(5, 7));
            int fyStartMonth = appSettingService.getFiscalYearStartMonth();
            int startYear = month >= fyStartMonth ? year : year - 1;
            return startYear + "/" + (startYear + 1);
        } catch (Exception e) {
            return null;
        }
    }
}
