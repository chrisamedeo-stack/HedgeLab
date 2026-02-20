package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.SaveBudgetLineRequest;
import com.hedgelab.api.dto.response.CornBudgetLineResponse;
import com.hedgelab.api.dto.response.CornBudgetLineResponse.ComponentDto;
import com.hedgelab.api.entity.CornBudgetComponent;
import com.hedgelab.api.entity.CornBudgetLine;
import com.hedgelab.api.entity.Site;
import com.hedgelab.api.repository.CornBudgetLineRepository;
import com.hedgelab.api.repository.SiteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CornBudgetService {

    private static final BigDecimal BUSHELS_PER_MT   = new BigDecimal("39.3683");
    private static final BigDecimal CENTS_PER_DOLLAR = new BigDecimal("100");

    private final CornBudgetLineRepository budgetRepo;
    private final SiteRepository           siteRepo;
    private final AppSettingService        appSettingService;

    // ─── Queries ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CornBudgetLineResponse> getAll(String siteCode, String cropYear, String fiscalYear) {
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
        return lines.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CornBudgetLineResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    // ─── Mutations ────────────────────────────────────────────────────────────

    @Transactional
    public CornBudgetLineResponse create(SaveBudgetLineRequest req) {
        Site site = siteRepo.findByCode(req.getSiteCode())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Site not found: " + req.getSiteCode()));

        // Derive missing volume unit from the other
        BigDecimal bu = req.getBudgetVolumeBu();
        BigDecimal mt = req.getBudgetVolumeMt();
        if (bu != null && mt == null) {
            mt = bu.divide(BUSHELS_PER_MT, 4, RoundingMode.HALF_UP);
        } else if (mt != null && bu == null) {
            bu = mt.multiply(BUSHELS_PER_MT).setScale(2, RoundingMode.HALF_UP);
        }

        String explicitFy = req.getFiscalYear() != null ? req.getFiscalYear() : req.getCropYear();
        CornBudgetLine line = CornBudgetLine.builder()
                .site(site)
                .commodityCode(req.getCommodityCode() != null ? req.getCommodityCode() : "CORN-ZC")
                .budgetMonth(req.getBudgetMonth())
                .futuresMonth(req.getFuturesMonth())
                .budgetVolumeMt(mt)
                .budgetVolumeBu(bu)
                .cropYear(resolveFiscalYear(req.getBudgetMonth(), explicitFy))
                .notes(req.getNotes())
                .build();

        applyComponents(line, req);
        return toResponse(budgetRepo.save(line));
    }

    @Transactional
    public CornBudgetLineResponse update(Long id, SaveBudgetLineRequest req) {
        CornBudgetLine line = findOrThrow(id);

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
            mt = bu.divide(BUSHELS_PER_MT, 4, RoundingMode.HALF_UP);
        } else if (mt != null && bu == null) {
            bu = mt.multiply(BUSHELS_PER_MT).setScale(2, RoundingMode.HALF_UP);
        }
        if (mt != null) line.setBudgetVolumeMt(mt);
        if (bu != null) line.setBudgetVolumeBu(bu);

        if (req.getNotes() != null) line.setNotes(req.getNotes());

        String explicitFy = req.getFiscalYear() != null ? req.getFiscalYear() : req.getCropYear();
        String monthForFy = req.getBudgetMonth() != null ? req.getBudgetMonth() : line.getBudgetMonth();
        line.setCropYear(resolveFiscalYear(monthForFy, explicitFy));

        if (req.getComponents() != null) {
            line.getComponents().clear();
            applyComponents(line, req);
        }

        return toResponse(budgetRepo.save(line));
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

    private BigDecimal toUsdPerMt(BigDecimal value, String unit) {
        if (value == null) return BigDecimal.ZERO;
        String u = unit != null ? unit.trim().toLowerCase() : "$/mt";
        if (u.equals("¢/bu") || u.equals("cents/bu") || u.equals("c/bu")) {
            return value.divide(CENTS_PER_DOLLAR, 10, RoundingMode.HALF_UP)
                        .multiply(BUSHELS_PER_MT)
                        .setScale(4, RoundingMode.HALF_UP);
        }
        return value.setScale(4, RoundingMode.HALF_UP);
    }

    private CornBudgetLineResponse toResponse(CornBudgetLine line) {
        List<ComponentDto> compDtos = line.getComponents().stream().map(c -> {
            BigDecimal perMt = toUsdPerMt(c.getTargetValue(), c.getUnit());
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
                .fiscalYear(line.getCropYear()) // cropYear column stores the fiscal year value
                .notes(line.getNotes())
                .targetAllInPerMt(allIn.compareTo(BigDecimal.ZERO) == 0 ? null : allIn)
                .components(compDtos)
                .build();
    }

    /**
     * Derive fiscal year from budget month using configurable FY boundaries.
     * Uses the FISCAL_YEAR_START_MONTH setting (default 7 = July).
     * e.g. with start month 7: 2026-05 → "2025/2026", 2025-09 → "2025/2026"
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
