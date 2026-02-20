package com.hedgelab.api.service;

import com.hedgelab.api.dto.response.CoverageResponse;
import com.hedgelab.api.dto.response.CoverageResponse.MonthDetail;
import com.hedgelab.api.entity.CornBudgetLine;
import com.hedgelab.api.entity.EFPTicket;
import com.hedgelab.api.entity.ReceiptTicket;
import com.hedgelab.api.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CoverageService {

    private static final BigDecimal BUSHELS_PER_MT = new BigDecimal("39.3683");
    private static final int        BUSHELS_PER_LOT = 5000;

    private final SiteRepository             siteRepository;
    private final CornBudgetLineRepository   budgetRepository;
    private final PhysicalContractRepository contractRepository;
    private final HedgeAllocationRepository  allocationRepository;
    private final EFPTicketRepository        efpRepository;
    private final ReceiptTicketRepository    receiptRepository;

    @Transactional(readOnly = true)
    public List<CoverageResponse> getCoverage() {
        return siteRepository.findAll().stream().map(site -> {
            String code = site.getCode();

            // ── Load all data for this site once ─────────────────────────────

            List<CornBudgetLine> budgetLines =
                    budgetRepository.findBySiteCodeOrderByBudgetMonthAsc(code);

            BigDecimal budgetedMt = budgetLines.stream()
                    .map(b -> b.getBudgetVolumeMt() != null ? b.getBudgetVolumeMt() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal committedMt = contractRepository.findBySiteCodeOrderByContractDateDesc(code).stream()
                    .map(c -> c.getQuantityMt() != null ? c.getQuantityMt() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            // Hedged MT via allocations (per site)
            List<com.hedgelab.api.entity.HedgeAllocation> siteAllocations =
                    allocationRepository.findBySite_CodeOrderByBudgetMonthAsc(code);

            BigDecimal hedgedMt = siteAllocations.stream()
                    .map(a -> BigDecimal.valueOf((long) a.getAllocatedLots() * BUSHELS_PER_LOT)
                            .divide(BUSHELS_PER_MT, 4, RoundingMode.HALF_UP))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            // EFP tickets for this site (via physical contract → site)
            List<EFPTicket> siteEfps = efpRepository.findAll().stream()
                    .filter(e -> e.getPhysicalContract().getSite().getCode().equals(code))
                    .collect(Collectors.toList());

            BigDecimal efpdMt = siteEfps.stream()
                    .map(e -> e.getQuantityMt() != null ? e.getQuantityMt() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal receivedMt = receiptRepository.findBySiteCodeOrderByReceiptDateDesc(code).stream()
                    .map(r -> r.getNetMt() != null ? r.getNetMt() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal coveragePct = budgetedMt.compareTo(BigDecimal.ZERO) > 0
                    ? hedgedMt.divide(budgetedMt, 4, RoundingMode.HALF_UP)
                             .multiply(new BigDecimal("100"))
                    : BigDecimal.ZERO;

            BigDecimal openBasisMt = committedMt.subtract(efpdMt).max(BigDecimal.ZERO);

            BigDecimal openLots = siteAllocations.stream()
                    .map(a -> BigDecimal.valueOf(a.getAllocatedLots()))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            // ── Per-month breakdown ───────────────────────────────────────────

            // Group allocations by budgetMonth
            Map<String, BigDecimal> allocByMonth = siteAllocations.stream()
                    .collect(Collectors.groupingBy(
                            com.hedgelab.api.entity.HedgeAllocation::getBudgetMonth,
                            Collectors.reducing(BigDecimal.ZERO,
                                    a -> BigDecimal.valueOf((long) a.getAllocatedLots() * BUSHELS_PER_LOT)
                                            .divide(BUSHELS_PER_MT, 4, RoundingMode.HALF_UP),
                                    BigDecimal::add)));

            // Group EFPs by physical contract deliveryMonth
            Map<String, BigDecimal> efpByMonth = siteEfps.stream()
                    .filter(e -> e.getPhysicalContract().getDeliveryMonth() != null)
                    .collect(Collectors.groupingBy(
                            e -> e.getPhysicalContract().getDeliveryMonth(),
                            Collectors.reducing(BigDecimal.ZERO,
                                    e -> e.getQuantityMt() != null ? e.getQuantityMt() : BigDecimal.ZERO,
                                    BigDecimal::add)));

            // Group receipts by receiptDate YYYY-MM
            Map<String, BigDecimal> receiptByMonth = receiptRepository
                    .findBySiteCodeOrderByReceiptDateDesc(code).stream()
                    .filter(r -> r.getReceiptDate() != null)
                    .collect(Collectors.groupingBy(
                            r -> String.format("%d-%02d",
                                    r.getReceiptDate().getYear(),
                                    r.getReceiptDate().getMonthValue()),
                            Collectors.reducing(BigDecimal.ZERO,
                                    r -> r.getNetMt() != null ? r.getNetMt() : BigDecimal.ZERO,
                                    BigDecimal::add)));

            // Group committed MT by deliveryMonth from physical contracts
            Map<String, BigDecimal> committedByMonth = contractRepository
                    .findBySiteCodeOrderByContractDateDesc(code).stream()
                    .filter(c -> c.getDeliveryMonth() != null)
                    .collect(Collectors.groupingBy(
                            com.hedgelab.api.entity.PhysicalContract::getDeliveryMonth,
                            Collectors.reducing(BigDecimal.ZERO,
                                    c -> c.getQuantityMt() != null ? c.getQuantityMt() : BigDecimal.ZERO,
                                    BigDecimal::add)));

            // Build month details — anchor on budget months (sorted)
            List<MonthDetail> months = budgetLines.stream()
                    .sorted(Comparator.comparing(CornBudgetLine::getBudgetMonth))
                    .map(bl -> {
                        String m            = bl.getBudgetMonth();
                        BigDecimal bMt      = bl.getBudgetVolumeMt() != null ? bl.getBudgetVolumeMt() : BigDecimal.ZERO;
                        BigDecimal cMt      = committedByMonth.getOrDefault(m, BigDecimal.ZERO);
                        BigDecimal hMt      = allocByMonth.getOrDefault(m, BigDecimal.ZERO);
                        BigDecimal eMt      = efpByMonth.getOrDefault(m, BigDecimal.ZERO);
                        BigDecimal rMt      = receiptByMonth.getOrDefault(m, BigDecimal.ZERO);
                        BigDecimal covPct   = bMt.compareTo(BigDecimal.ZERO) > 0
                                ? hMt.divide(bMt, 4, RoundingMode.HALF_UP)
                                     .multiply(new BigDecimal("100"))
                                : BigDecimal.ZERO;
                        return MonthDetail.builder()
                                .month(m)
                                .budgetedMt(bMt)
                                .committedMt(cMt)
                                .hedgedMt(hMt)
                                .efpdMt(eMt)
                                .receivedMt(rMt)
                                .coveragePct(covPct)
                                .build();
                    })
                    .collect(Collectors.toList());

            return CoverageResponse.builder()
                    .siteCode(code).siteName(site.getName())
                    .budgetedMt(budgetedMt).committedMt(committedMt)
                    .hedgedMt(hedgedMt).efpdMt(efpdMt)
                    .receivedMt(receivedMt).coveragePct(coveragePct)
                    .openBasisMt(openBasisMt).openHedgeLots(openLots)
                    .months(months)
                    .build();
        }).collect(Collectors.toList());
    }
}
