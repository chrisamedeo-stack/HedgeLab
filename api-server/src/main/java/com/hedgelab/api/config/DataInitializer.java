package com.hedgelab.api.config;

import com.hedgelab.api.dto.request.*;
import com.hedgelab.api.dto.response.*;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.repository.*;
import com.hedgelab.api.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

@Slf4j
@Profile("dev")
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final CommodityService commodityService;
    private final CounterpartyService counterpartyService;
    private final BookService bookService;
    private final PriceIndexService priceIndexService;
    private final MarketDataService marketDataService;
    private final TradeService tradeService;

    private final CommodityRepository commodityRepo;
    private final CounterpartyRepository counterpartyRepo;
    private final BookRepository bookRepo;
    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final com.hedgelab.api.repository.SiteRepository siteRepository;
    private final com.hedgelab.api.repository.SiteBudgetRepository siteBudgetRepository;

    @Override
    public void run(ApplicationArguments args) {
        try {
            runSeed();
        } catch (Exception e) {
            log.error("DataInitializer failed: {}", e.getMessage(), e);
        }
    }

    private void runSeed() {
        if (commodityRepo.count() > 0) {
            log.info("DataInitializer: data already present, skipping seed.");
            return;
        }
        log.info("DataInitializer: seeding reference data...");

        // ── Commodities ─────────────────────────────────────────────────────────
        CommodityResponse brent = commodityService.create(new CreateCommodityRequest(
            "BRENT", "Brent Crude Oil", CommodityCategory.ENERGY,
            UnitOfMeasure.BBL, "USD", true, "ICE Brent Crude Oil Futures", "AAWTR00"));

        CommodityResponse wti = commodityService.create(new CreateCommodityRequest(
            "WTI", "WTI Crude Oil", CommodityCategory.ENERGY,
            UnitOfMeasure.BBL, "USD", true, "NYMEX WTI Light Sweet Crude", "AAVBD00"));

        CommodityResponse ng = commodityService.create(new CreateCommodityRequest(
            "NATGAS", "Natural Gas", CommodityCategory.ENERGY,
            UnitOfMeasure.MMBTU, "USD", true, "Henry Hub Natural Gas", "NGUSHHUB"));

        CommodityResponse copper = commodityService.create(new CreateCommodityRequest(
            "COPPER", "LME Copper", CommodityCategory.METALS,
            UnitOfMeasure.MT, "USD", true, "LME Grade A Copper", "LMCADY00"));

        CommodityResponse corn = commodityService.create(new CreateCommodityRequest(
            "CORN", "CBOT Corn", CommodityCategory.AGRICULTURAL,
            UnitOfMeasure.BUSHEL, "USD", true, "CBOT Corn Futures", null));

        log.info("Seeded {} commodities", 5);

        // ── Counterparties ───────────────────────────────────────────────────────
        CounterpartyResponse shell = counterpartyService.create(new CreateCounterpartyRequest(
            "SHELL-TRD", "Shell Trading", "Shell Trading and Shipping Company",
            CounterpartyType.TRADER, CreditRating.AA,
            new BigDecimal("500000000"), "GB",
            "2138001SCL7RPEZRV149", "RC-12345678",
            "trading@shell.com", "+44-20-7934-1234",
            LocalDate.of(2020, 1, 15), "Major energy trader"));

        CounterpartyResponse bp = counterpartyService.create(new CreateCounterpartyRequest(
            "BP-OIL", "BP Oil International", "BP Oil International Ltd",
            CounterpartyType.PRODUCER, CreditRating.A,
            new BigDecimal("250000000"), "GB",
            "BPPTDE6SXBP6SWZOR7B8", "RC-87654321",
            "oil-trading@bp.com", "+44-20-7496-4000",
            LocalDate.of(2019, 6, 1), "Oil major"));

        CounterpartyResponse vitol = counterpartyService.create(new CreateCounterpartyRequest(
            "VITOL-GEN", "Vitol Group", "Vitol Group Holdings SA",
            CounterpartyType.TRADER, CreditRating.BBB,
            new BigDecimal("100000000"), "CH",
            "VITOLGE22XXX00000000", "CHE-123.456.789",
            "trading@vitol.com", "+41-22-322-4800",
            LocalDate.of(2021, 3, 10), "Independent commodity trader"));

        log.info("Seeded {} counterparties", 3);

        // ── Books ────────────────────────────────────────────────────────────────
        BookResponse energyBook = bookService.create(new CreateBookRequest(
            "ENERGY-CRUDE", "Crude Oil Trading Book", "Energy Desk",
            "Primary book for crude oil physical and financial trades"));

        BookResponse gasBook = bookService.create(new CreateBookRequest(
            "ENERGY-GAS", "Natural Gas Book", "Energy Desk",
            "Natural gas physical and financial trading"));

        BookResponse metalsBook = bookService.create(new CreateBookRequest(
            "METALS-BASE", "Base Metals Book", "Metals Desk",
            "LME base metals trading book"));

        log.info("Seeded {} books", 3);

        // ── Price Indices ────────────────────────────────────────────────────────
        PriceIndexResponse brentIdx = priceIndexService.create(new CreatePriceIndexRequest(
            "ICE-BRENT-1M", "ICE Brent Front Month", brent.id(),
            "ICE", "USD", UnitOfMeasure.BBL, "ICE Brent 1-month front contract"));

        PriceIndexResponse wtiIdx = priceIndexService.create(new CreatePriceIndexRequest(
            "NYMEX-WTI-1M", "NYMEX WTI Front Month", wti.id(),
            "NYMEX", "USD", UnitOfMeasure.BBL, "NYMEX WTI 1-month front contract"));

        PriceIndexResponse ngIdx = priceIndexService.create(new CreatePriceIndexRequest(
            "HH-NG-1M", "Henry Hub Front Month", ng.id(),
            "NYMEX", "USD", UnitOfMeasure.MMBTU, "Henry Hub natural gas front month"));

        PriceIndexResponse copperIdx = priceIndexService.create(new CreatePriceIndexRequest(
            "LME-CU-CASH", "LME Copper Cash", copper.id(),
            "LME", "USD", UnitOfMeasure.MT, "LME Copper cash settlement price"));

        log.info("Seeded {} price indices", 4);

        // ── Daily Prices ─────────────────────────────────────────────────────────
        LocalDate today = LocalDate.now();
        LocalDate yesterday = today.minusDays(1);

        List<PublishDailyPriceRequest> prices = List.of(
            new PublishDailyPriceRequest("ICE-BRENT-1M", yesterday, new BigDecimal("82.45"), "SETTLE", "ICE"),
            new PublishDailyPriceRequest("ICE-BRENT-1M", today, new BigDecimal("83.10"), "SETTLE", "ICE"),
            new PublishDailyPriceRequest("NYMEX-WTI-1M", yesterday, new BigDecimal("78.90"), "SETTLE", "NYMEX"),
            new PublishDailyPriceRequest("NYMEX-WTI-1M", today, new BigDecimal("79.55"), "SETTLE", "NYMEX"),
            new PublishDailyPriceRequest("HH-NG-1M", yesterday, new BigDecimal("2.15"), "SETTLE", "NYMEX"),
            new PublishDailyPriceRequest("HH-NG-1M", today, new BigDecimal("2.22"), "SETTLE", "NYMEX"),
            new PublishDailyPriceRequest("LME-CU-CASH", yesterday, new BigDecimal("9250.00"), "SETTLE", "LME"),
            new PublishDailyPriceRequest("LME-CU-CASH", today, new BigDecimal("9310.00"), "SETTLE", "LME")
        );
        marketDataService.publishPriceBatch(prices);
        log.info("Seeded {} daily prices", prices.size());

        // ── Forward Curves ────────────────────────────────────────────────────────
        YearMonth m0 = YearMonth.now();
        marketDataService.publishForwardCurve("ICE-BRENT-1M", today, Map.of(
            m0,                    new BigDecimal("83.10"),
            m0.plusMonths(1),      new BigDecimal("82.80"),
            m0.plusMonths(2),      new BigDecimal("82.50"),
            m0.plusMonths(3),      new BigDecimal("82.20"),
            m0.plusMonths(6),      new BigDecimal("81.50"),
            m0.plusMonths(12),     new BigDecimal("80.00")
        ));
        marketDataService.publishForwardCurve("NYMEX-WTI-1M", today, Map.of(
            m0,                    new BigDecimal("79.55"),
            m0.plusMonths(1),      new BigDecimal("79.20"),
            m0.plusMonths(2),      new BigDecimal("78.90"),
            m0.plusMonths(3),      new BigDecimal("78.60"),
            m0.plusMonths(6),      new BigDecimal("77.80"),
            m0.plusMonths(12),     new BigDecimal("76.50")
        ));
        log.info("Seeded forward curves for BRENT and WTI");

        // ── Sample Trades ─────────────────────────────────────────────────────────
        LocalDate tradeDate = today;
        LocalDate start = today.withDayOfMonth(1);
        LocalDate end = today.withDayOfMonth(1).plusMonths(2).minusDays(1);

        // Trade 1: Fixed price crude buy with Shell
        TradeResponse trade1 = tradeService.capture(new CreateTradeRequest(
            TradeType.PHYSICAL_BUY, shell.id(), brent.id(), energyBook.id(),
            tradeDate, start, end,
            new BigDecimal("100000"), UnitOfMeasure.BBL,
            PricingType.FIXED, new BigDecimal("82.00"), null, null,
            BigDecimal.ZERO, "USD",
            "SHELL-2026-001", "Fixed price crude purchase from Shell"));

        // Trade 2: Index-linked gas sell with BP
        TradeResponse trade2 = tradeService.capture(new CreateTradeRequest(
            TradeType.PHYSICAL_SELL, bp.id(), ng.id(), gasBook.id(),
            tradeDate, start, end,
            new BigDecimal("500000"), UnitOfMeasure.MMBTU,
            PricingType.INDEX, null, ngIdx.id(), null,
            new BigDecimal("0.05"), "USD",
            "BP-GAS-2026-001", "Index-linked gas sale to BP with spread"));

        // Trade 3: Financial crude sell (paper) with Vitol
        TradeResponse trade3 = tradeService.capture(new CreateTradeRequest(
            TradeType.FINANCIAL_SELL, vitol.id(), brent.id(), energyBook.id(),
            tradeDate, start, start.plusMonths(1).minusDays(1),
            new BigDecimal("50000"), UnitOfMeasure.BBL,
            PricingType.INDEX, null, brentIdx.id(), null,
            BigDecimal.ZERO, "USD",
            "VITOL-FIN-2026-001", "Financial brent hedge with Vitol"));

        log.info("Seeded 3 sample trades (DRAFT status)");

        // Confirm trade 1 (fixed price — no market data dependency)
        try {
            tradeService.confirm(trade1.id());
            log.info("Confirmed trade {}", trade1.tradeReference());
        } catch (Exception e) {
            log.warn("Could not confirm trade {}: {}", trade1.tradeReference(), e.getMessage());
        }

        // ── Default Users ──────────────────────────────────────────────────────
        if (appUserRepository.count() == 0) {
            String hash = passwordEncoder.encode("admin123");
            appUserRepository.saveAll(List.of(
                AppUser.builder().username("admin").email("admin@hedgelab.com").passwordHash(hash).role(AppRole.ADMIN).build(),
                AppUser.builder().username("risk_manager").email("risk@hedgelab.com").passwordHash(hash).role(AppRole.RISK_MANAGER).build(),
                AppUser.builder().username("trader").email("trader@hedgelab.com").passwordHash(hash).role(AppRole.TRADER).build(),
                AppUser.builder().username("readonly").email("readonly@hedgelab.com").passwordHash(hash).role(AppRole.READ_ONLY).build()
            ));
            log.info("Seeded 4 default users (all password: admin123)");
        }

        // ── Corn Module Seed ────────────────────────────────────────────────────
        seedCornData();

        log.info("DataInitializer: seed complete.");
    }

    private void seedCornData() {
        // ── Sites ────────────────────────────────────────────────────────────────
        com.hedgelab.api.entity.Site gm1 = siteRepository.findByCode("GM1").orElseGet(() ->
            siteRepository.save(com.hedgelab.api.entity.Site.builder()
                .code("GM1").name("Gimli").country("Canada").province("MB").build()));
        com.hedgelab.api.entity.Site vf1 = siteRepository.findByCode("VF1").orElseGet(() ->
            siteRepository.save(com.hedgelab.api.entity.Site.builder()
                .code("VF1").name("Valleyfield").country("Canada").province("QC").build()));
        log.info("Seeded corn sites: GM1, VF1");

        // ── Corn Supplier Counterparties ─────────────────────────────────────────
        counterpartyRepo.findAll().stream()
            .filter(cp -> cp.getShortName().equals("Scoular")).findFirst()
            .orElseGet(() -> counterpartyRepo.save(Counterparty.builder()
                .legalEntityCode("SCOULAR-AG").shortName("Scoular")
                .fullLegalName("The Scoular Company")
                .type(CounterpartyType.SUPPLIER).status(CounterpartyStatus.ACTIVE)
                .creditLimitUsd(java.math.BigDecimal.ZERO)
                .currentExposureUsd(java.math.BigDecimal.ZERO)
                .country("CA").build()));
        counterpartyRepo.findAll().stream()
            .filter(cp -> cp.getShortName().equals("BPGrain")).findFirst()
            .orElseGet(() -> counterpartyRepo.save(Counterparty.builder()
                .legalEntityCode("BPGRAIN-AG").shortName("BPGrain")
                .fullLegalName("BP Grain Ltd")
                .type(CounterpartyType.SUPPLIER).status(CounterpartyStatus.ACTIVE)
                .creditLimitUsd(java.math.BigDecimal.ZERO)
                .currentExposureUsd(java.math.BigDecimal.ZERO)
                .country("CA").build()));
        log.info("Seeded corn supplier counterparties: Scoular, BPGrain");

        // ── GM1 Site Budgets (Jul 2025 - Jun 2026) ───────────────────────────────
        java.math.BigDecimal gm1Price = new java.math.BigDecimal("244.87");
        java.util.List<Object[]> gm1Budgets = java.util.List.of(
            new Object[]{"2025-07", 5200}, new Object[]{"2025-08", 3400},
            new Object[]{"2025-09", 0},    new Object[]{"2025-10", 3750},
            new Object[]{"2025-11", 5000}, new Object[]{"2025-12", 4000},
            new Object[]{"2026-01", 4000}, new Object[]{"2026-02", 4000},
            new Object[]{"2026-03", 6000}, new Object[]{"2026-04", 5000},
            new Object[]{"2026-05", 5000}, new Object[]{"2026-06", 4500}
        );
        for (Object[] row : gm1Budgets) {
            String month = (String) row[0];
            int vol = (int) row[1];
            siteBudgetRepository.findBySiteCodeAndDeliveryMonth("GM1", month).orElseGet(() ->
                siteBudgetRepository.save(com.hedgelab.api.entity.SiteBudget.builder()
                    .site(gm1).deliveryMonth(month)
                    .budgetVolumeMt(new java.math.BigDecimal(vol))
                    .budgetPricePerMt(gm1Price).build()));
        }
        log.info("Seeded GM1 site budgets (Jul 2025 - Jun 2026)");

        // ── VF1 Site Budgets (Aug 2025 - Jun 2026) ───────────────────────────────
        java.math.BigDecimal vf1Price = new java.math.BigDecimal("250.78");
        java.util.List<Object[]> vf1Budgets = java.util.List.of(
            new Object[]{"2025-08", 2080}, new Object[]{"2025-09", 3528},
            new Object[]{"2025-10", 3711}, new Object[]{"2025-11", 3528},
            new Object[]{"2025-12", 1158}, new Object[]{"2026-01", 2210},
            new Object[]{"2026-02", 2860}, new Object[]{"2026-03", 3120},
            new Object[]{"2026-04", 3055}, new Object[]{"2026-05", 3120},
            new Object[]{"2026-06", 3120}
        );
        for (Object[] row : vf1Budgets) {
            String month = (String) row[0];
            int vol = (int) row[1];
            siteBudgetRepository.findBySiteCodeAndDeliveryMonth("VF1", month).orElseGet(() ->
                siteBudgetRepository.save(com.hedgelab.api.entity.SiteBudget.builder()
                    .site(vf1).deliveryMonth(month)
                    .budgetVolumeMt(new java.math.BigDecimal(vol))
                    .budgetPricePerMt(vf1Price).build()));
        }
        log.info("Seeded VF1 site budgets (Aug 2025 - Jun 2026)");
    }
}
