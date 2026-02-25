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
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
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
    private final AppSettingRepository appSettingRepository;
    private final CornBudgetLineRepository cornBudgetLineRepository;
    private final HedgeTradeRepository hedgeTradeRepository;
    private final HedgeAllocationRepository hedgeAllocationRepository;
    private final PhysicalContractRepository physicalContractRepository;
    private final EFPTicketRepository efpTicketRepository;
    private final ReceiptTicketRepository receiptTicketRepository;
    private final CornDailySettleRepository cornDailySettleRepository;

    private static final BigDecimal BUSHELS_PER_MT = new BigDecimal("39.3683");
    private static final int BUSHELS_PER_LOT = 5000;

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
        Site gm1 = siteRepository.findByCode("GM1").orElseGet(() ->
            siteRepository.save(Site.builder()
                .code("GM1").name("Gimli").country("Canada").province("MB").build()));
        Site vf1 = siteRepository.findByCode("VF1").orElseGet(() ->
            siteRepository.save(Site.builder()
                .code("VF1").name("Valleyfield").country("Canada").province("QC").build()));
        log.info("Seeded corn sites: GM1, VF1");

        // ── Corn Supplier Counterparties ─────────────────────────────────────────
        counterpartyRepo.findAll().stream()
            .filter(cp -> cp.getShortName().equals("Scoular")).findFirst()
            .orElseGet(() -> counterpartyRepo.save(Counterparty.builder()
                .legalEntityCode("SCOULAR-AG").shortName("Scoular")
                .fullLegalName("The Scoular Company")
                .type(CounterpartyType.SUPPLIER).status(CounterpartyStatus.ACTIVE)
                .creditLimitUsd(BigDecimal.ZERO)
                .currentExposureUsd(BigDecimal.ZERO)
                .country("CA").build()));
        counterpartyRepo.findAll().stream()
            .filter(cp -> cp.getShortName().equals("BPGrain")).findFirst()
            .orElseGet(() -> counterpartyRepo.save(Counterparty.builder()
                .legalEntityCode("BPGRAIN-AG").shortName("BPGrain")
                .fullLegalName("BP Grain Ltd")
                .type(CounterpartyType.SUPPLIER).status(CounterpartyStatus.ACTIVE)
                .creditLimitUsd(BigDecimal.ZERO)
                .currentExposureUsd(BigDecimal.ZERO)
                .country("CA").build()));
        log.info("Seeded corn supplier counterparties: Scoular, BPGrain");

        // ── GM1 Site Budgets (Jul 2025 - Jun 2026) ───────────────────────────────
        BigDecimal gm1Price = new BigDecimal("244.87");
        List<Object[]> gm1Budgets = List.of(
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
                siteBudgetRepository.save(SiteBudget.builder()
                    .site(gm1).deliveryMonth(month)
                    .budgetVolumeMt(new BigDecimal(vol))
                    .budgetPricePerMt(gm1Price).build()));
        }
        log.info("Seeded GM1 site budgets (Jul 2025 - Jun 2026)");

        // ── VF1 Site Budgets (Aug 2025 - Jun 2026) ───────────────────────────────
        BigDecimal vf1Price = new BigDecimal("250.78");
        List<Object[]> vf1Budgets = List.of(
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
                siteBudgetRepository.save(SiteBudget.builder()
                    .site(vf1).deliveryMonth(month)
                    .budgetVolumeMt(new BigDecimal(vol))
                    .budgetPricePerMt(vf1Price).build()));
        }
        log.info("Seeded VF1 site budgets (Aug 2025 - Jun 2026)");

        // ── App Settings ──────────────────────────────────────────────────────────
        appSettingRepository.findBySettingKey("corn.crop_year").orElseGet(() ->
            appSettingRepository.save(AppSetting.builder()
                .settingKey("corn.crop_year").value("2025")
                .description("Active corn crop year").build()));
        log.info("Seeded app setting: corn.crop_year=2025");

        // ── Corn Budget Lines (24 lines: 12 months × 2 sites) ────────────────────
        if (cornBudgetLineRepository.count() == 0) {
            seedCornBudgetLines(gm1, vf1);
        }

        // ── Hedge Trades (10 trades) ──────────────────────────────────────────────
        if (hedgeTradeRepository.count() == 0) {
            seedHedgeTrades(gm1, vf1);
        }

        // ── Settle Prices ─────────────────────────────────────────────────────────
        if (cornDailySettleRepository.count() == 0) {
            seedSettlePrices();
        }
    }

    private void seedCornBudgetLines(Site gm1, Site vf1) {
        String cropYear = "2025/2026";

        // Futures month mapping: budgetMonth -> futuresMonth
        // ZCN25 for Jul-Aug, ZCU25 for Sep-Nov, ZCZ25 for Dec-Feb, ZCH26 for Mar-May, ZCN26 for Jun
        Map<String, String> futuresMap = Map.ofEntries(
            Map.entry("2025-07", "ZCN25"), Map.entry("2025-08", "ZCN25"),
            Map.entry("2025-09", "ZCU25"), Map.entry("2025-10", "ZCU25"),
            Map.entry("2025-11", "ZCU25"), Map.entry("2025-12", "ZCZ25"),
            Map.entry("2026-01", "ZCZ25"), Map.entry("2026-02", "ZCZ25"),
            Map.entry("2026-03", "ZCH26"), Map.entry("2026-04", "ZCH26"),
            Map.entry("2026-05", "ZCH26"), Map.entry("2026-06", "ZCN26")
        );

        // GM1: ~650 MT/month → ~25,587 bu/month
        int[] gm1Vols = {650, 650, 650, 650, 650, 650, 650, 650, 650, 650, 650, 650};
        String[] months = {"2025-07","2025-08","2025-09","2025-10","2025-11","2025-12",
                           "2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"};

        for (int i = 0; i < months.length; i++) {
            BigDecimal volMt = new BigDecimal(gm1Vols[i]);
            BigDecimal volBu = volMt.multiply(BUSHELS_PER_MT).setScale(2, RoundingMode.HALF_UP);
            CornBudgetLine line = cornBudgetLineRepository.save(CornBudgetLine.builder()
                .site(gm1).commodityCode("CORN").budgetMonth(months[i])
                .futuresMonth(futuresMap.get(months[i]))
                .budgetVolumeMt(volMt).budgetVolumeBu(volBu)
                .cropYear(cropYear).build());
            addComponents(line, futuresMap.get(months[i]));
        }

        // VF1: ~400 MT/month → ~15,747 bu/month
        int[] vf1Vols = {400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400};

        for (int i = 0; i < months.length; i++) {
            BigDecimal volMt = new BigDecimal(vf1Vols[i]);
            BigDecimal volBu = volMt.multiply(BUSHELS_PER_MT).setScale(2, RoundingMode.HALF_UP);
            CornBudgetLine line = cornBudgetLineRepository.save(CornBudgetLine.builder()
                .site(vf1).commodityCode("CORN").budgetMonth(months[i])
                .futuresMonth(futuresMap.get(months[i]))
                .budgetVolumeMt(volMt).budgetVolumeBu(volBu)
                .cropYear(cropYear).build());
            addComponents(line, futuresMap.get(months[i]));
        }

        log.info("Seeded 24 corn budget lines (12 months x 2 sites)");
    }

    private void addComponents(CornBudgetLine line, String futuresMonth) {
        List<CornBudgetComponent> comps = new ArrayList<>();
        comps.add(CornBudgetComponent.builder().budgetLine(line)
            .componentName("Board Price").unit("$/bu")
            .targetValue(new BigDecimal("4.50")).displayOrder(1).build());
        comps.add(CornBudgetComponent.builder().budgetLine(line)
            .componentName("Basis").unit("$/bu")
            .targetValue(new BigDecimal("-0.20")).displayOrder(2).build());
        comps.add(CornBudgetComponent.builder().budgetLine(line)
            .componentName("Freight").unit("$/MT")
            .targetValue(new BigDecimal("15.00")).displayOrder(3).build());
        line.setComponents(comps);
        cornBudgetLineRepository.save(line);
    }

    private void seedHedgeTrades(Site gm1, Site vf1) {
        LocalDate td = LocalDate.of(2025, 6, 15);

        // 10 hedge trades across various futures months
        HedgeTrade ht1 = hedgeTradeRepository.save(HedgeTrade.builder()
            .tradeRef("HT-2025-001").futuresMonth("ZCN25").lots(5).pricePerBushel(new BigDecimal("4.45"))
            .brokerAccount("StoneX").tradeDate(td).status(HedgeTradeStatus.FULLY_ALLOCATED)
            .openLots(3).book("CANADA").side("LONG").build());

        HedgeTrade ht2 = hedgeTradeRepository.save(HedgeTrade.builder()
            .tradeRef("HT-2025-002").futuresMonth("ZCN25").lots(3).pricePerBushel(new BigDecimal("4.4750"))
            .brokerAccount("StoneX").tradeDate(td.plusDays(2)).status(HedgeTradeStatus.PARTIALLY_ALLOCATED)
            .openLots(2).book("CANADA").side("LONG").build());

        HedgeTrade ht3 = hedgeTradeRepository.save(HedgeTrade.builder()
            .tradeRef("HT-2025-003").futuresMonth("ZCU25").lots(4).pricePerBushel(new BigDecimal("4.52"))
            .brokerAccount("StoneX").tradeDate(td.plusDays(5)).status(HedgeTradeStatus.FULLY_ALLOCATED)
            .openLots(2).book("CANADA").side("LONG").build());

        HedgeTrade ht4 = hedgeTradeRepository.save(HedgeTrade.builder()
            .tradeRef("HT-2025-004").futuresMonth("ZCU25").lots(3).pricePerBushel(new BigDecimal("4.50"))
            .brokerAccount("StoneX").tradeDate(td.plusDays(7)).status(HedgeTradeStatus.PARTIALLY_ALLOCATED)
            .openLots(2).book("CANADA").side("LONG").build());

        HedgeTrade ht5 = hedgeTradeRepository.save(HedgeTrade.builder()
            .tradeRef("HT-2025-005").futuresMonth("ZCZ25").lots(5).pricePerBushel(new BigDecimal("4.60"))
            .brokerAccount("StoneX").tradeDate(td.plusDays(10)).status(HedgeTradeStatus.FULLY_ALLOCATED)
            .openLots(3).book("CANADA").side("LONG").build());

        HedgeTrade ht6 = hedgeTradeRepository.save(HedgeTrade.builder()
            .tradeRef("HT-2025-006").futuresMonth("ZCZ25").lots(2).pricePerBushel(new BigDecimal("4.62"))
            .brokerAccount("StoneX").tradeDate(td.plusDays(12)).status(HedgeTradeStatus.OPEN)
            .openLots(2).book("CANADA").side("LONG").build());

        HedgeTrade ht7 = hedgeTradeRepository.save(HedgeTrade.builder()
            .tradeRef("HT-2025-007").futuresMonth("ZCH26").lots(4).pricePerBushel(new BigDecimal("4.75"))
            .brokerAccount("StoneX").tradeDate(td.plusDays(15)).status(HedgeTradeStatus.PARTIALLY_ALLOCATED)
            .openLots(2).book("CANADA").side("LONG").build());

        HedgeTrade ht8 = hedgeTradeRepository.save(HedgeTrade.builder()
            .tradeRef("HT-2025-008").futuresMonth("ZCH26").lots(3).pricePerBushel(new BigDecimal("4.78"))
            .brokerAccount("StoneX").tradeDate(td.plusDays(18)).status(HedgeTradeStatus.OPEN)
            .openLots(3).book("CANADA").side("LONG").build());

        HedgeTrade ht9 = hedgeTradeRepository.save(HedgeTrade.builder()
            .tradeRef("HT-2025-009").futuresMonth("ZCN26").lots(3).pricePerBushel(new BigDecimal("4.90"))
            .brokerAccount("StoneX").tradeDate(td.plusDays(20)).status(HedgeTradeStatus.OPEN)
            .openLots(3).book("CANADA").side("LONG").build());

        HedgeTrade ht10 = hedgeTradeRepository.save(HedgeTrade.builder()
            .tradeRef("HT-2025-010").futuresMonth("ZCN26").lots(2).pricePerBushel(new BigDecimal("4.85"))
            .brokerAccount("StoneX").tradeDate(td.plusDays(22)).status(HedgeTradeStatus.OPEN)
            .openLots(2).book("CANADA").side("LONG").build());

        log.info("Seeded 10 corn hedge trades");

        // ── Hedge Allocations (9 allocations) ─────────────────────────────────────
        // HT1: 5 lots → 3 to GM1 Jul, 2 to VF1 Aug
        hedgeAllocationRepository.save(HedgeAllocation.builder()
            .hedgeTrade(ht1).site(gm1).budgetMonth("2025-07").allocatedLots(3).build());
        hedgeAllocationRepository.save(HedgeAllocation.builder()
            .hedgeTrade(ht1).site(vf1).budgetMonth("2025-08").allocatedLots(2).build());

        // HT2: 3 lots → 1 to GM1 Aug
        hedgeAllocationRepository.save(HedgeAllocation.builder()
            .hedgeTrade(ht2).site(gm1).budgetMonth("2025-08").allocatedLots(1).build());

        // HT3: 4 lots → 2 to GM1 Sep, 2 to VF1 Oct
        hedgeAllocationRepository.save(HedgeAllocation.builder()
            .hedgeTrade(ht3).site(gm1).budgetMonth("2025-09").allocatedLots(2).build());
        hedgeAllocationRepository.save(HedgeAllocation.builder()
            .hedgeTrade(ht3).site(vf1).budgetMonth("2025-10").allocatedLots(2).build());

        // HT4: 3 lots → 1 to GM1 Nov
        hedgeAllocationRepository.save(HedgeAllocation.builder()
            .hedgeTrade(ht4).site(gm1).budgetMonth("2025-11").allocatedLots(1).build());

        // HT5: 5 lots → 3 to GM1 Dec, 2 to VF1 Jan
        hedgeAllocationRepository.save(HedgeAllocation.builder()
            .hedgeTrade(ht5).site(gm1).budgetMonth("2025-12").allocatedLots(3).build());
        hedgeAllocationRepository.save(HedgeAllocation.builder()
            .hedgeTrade(ht5).site(vf1).budgetMonth("2026-01").allocatedLots(2).build());

        // HT7: 4 lots → 2 to GM1 Mar
        hedgeAllocationRepository.save(HedgeAllocation.builder()
            .hedgeTrade(ht7).site(gm1).budgetMonth("2026-03").allocatedLots(2).build());

        log.info("Seeded 9 hedge allocations");

        // ── Physical Contracts (7 contracts) ──────────────────────────────────────
        PhysicalContract pc1 = physicalContractRepository.save(PhysicalContract.builder()
            .contractRef("PC-GM1-2025-001").site(gm1).supplierName("Scoular")
            .commodityCode("CORN").quantityMt(new BigDecimal("635.000"))
            .deliveryMonth("2025-07").basisPerBu(new BigDecimal("-0.18"))
            .futuresRef("ZCN25").currency("USD").status(PhysicalContractStatus.OPEN)
            .contractDate(LocalDate.of(2025, 5, 20)).tradeType(PhysicalContractTradeType.BASIS).build());

        PhysicalContract pc2 = physicalContractRepository.save(PhysicalContract.builder()
            .contractRef("PC-GM1-2025-002").site(gm1).supplierName("BPGrain")
            .commodityCode("CORN").quantityMt(new BigDecimal("508.000"))
            .deliveryMonth("2025-08").basisPerBu(new BigDecimal("-0.20"))
            .futuresRef("ZCN25").currency("USD").status(PhysicalContractStatus.OPEN)
            .contractDate(LocalDate.of(2025, 5, 25)).tradeType(PhysicalContractTradeType.BASIS).build());

        PhysicalContract pc3 = physicalContractRepository.save(PhysicalContract.builder()
            .contractRef("PC-VF1-2025-001").site(vf1).supplierName("Scoular")
            .commodityCode("CORN").quantityMt(new BigDecimal("381.000"))
            .deliveryMonth("2025-09").basisPerBu(new BigDecimal("-0.15"))
            .futuresRef("ZCU25").currency("USD").status(PhysicalContractStatus.OPEN)
            .contractDate(LocalDate.of(2025, 6, 1)).tradeType(PhysicalContractTradeType.BASIS).build());

        PhysicalContract pc4 = physicalContractRepository.save(PhysicalContract.builder()
            .contractRef("PC-GM1-2025-003").site(gm1).supplierName("Scoular")
            .commodityCode("CORN").quantityMt(new BigDecimal("762.000"))
            .deliveryMonth("2025-10").basisPerBu(new BigDecimal("-0.17"))
            .futuresRef("ZCU25").currency("USD").status(PhysicalContractStatus.BASIS_LOCKED)
            .basisLockedDate(LocalDate.of(2025, 6, 10))
            .contractDate(LocalDate.of(2025, 6, 5)).tradeType(PhysicalContractTradeType.BASIS).build());

        PhysicalContract pc5 = physicalContractRepository.save(PhysicalContract.builder()
            .contractRef("PC-VF1-2025-002").site(vf1).supplierName("BPGrain")
            .commodityCode("CORN").quantityMt(new BigDecimal("400.000"))
            .deliveryMonth("2025-11").basisPerBu(new BigDecimal("-0.22"))
            .futuresRef("ZCU25").currency("USD").status(PhysicalContractStatus.OPEN)
            .contractDate(LocalDate.of(2025, 6, 8)).tradeType(PhysicalContractTradeType.BASIS).build());

        PhysicalContract pc6 = physicalContractRepository.save(PhysicalContract.builder()
            .contractRef("PC-GM1-2025-004").site(gm1).supplierName("Scoular")
            .commodityCode("CORN").quantityMt(new BigDecimal("635.000"))
            .deliveryMonth("2025-12").basisPerBu(new BigDecimal("-0.16"))
            .futuresRef("ZCZ25").currency("USD").status(PhysicalContractStatus.CLOSED)
            .boardPricePerBu(new BigDecimal("4.60")).basisLockedDate(LocalDate.of(2025, 6, 15))
            .contractDate(LocalDate.of(2025, 6, 10)).tradeType(PhysicalContractTradeType.BASIS).build());

        PhysicalContract pc7 = physicalContractRepository.save(PhysicalContract.builder()
            .contractRef("PC-GM1-2025-005").site(gm1).supplierName("BPGrain")
            .commodityCode("CORN").quantityMt(new BigDecimal("254.000"))
            .deliveryMonth("2026-01").basisPerBu(new BigDecimal("-0.19"))
            .futuresRef("ZCZ25").currency("USD").status(PhysicalContractStatus.CANCELLED)
            .contractDate(LocalDate.of(2025, 6, 12)).tradeType(PhysicalContractTradeType.BASIS).build());

        log.info("Seeded 7 physical contracts");

        // ── EFP Tickets (4 tickets) ────────────────────────────────────────────────
        efpTicketRepository.save(EFPTicket.builder()
            .ticketRef("EFP-2025-001").hedgeTrade(ht1).physicalContract(pc1)
            .lots(2).futuresMonth("ZCN25")
            .boardPrice(new BigDecimal("4.45")).basisValue(new BigDecimal("-0.18"))
            .quantityMt(lotToMt(2)).efpDate(LocalDate.of(2025, 6, 20))
            .confirmationRef("SX-EFP-001").status(EFPTicketStatus.CONFIRMED)
            .entryPrice(new BigDecimal("4.45")).build());

        efpTicketRepository.save(EFPTicket.builder()
            .ticketRef("EFP-2025-002").hedgeTrade(ht3).physicalContract(pc3)
            .lots(2).futuresMonth("ZCU25")
            .boardPrice(new BigDecimal("4.52")).basisValue(new BigDecimal("-0.15"))
            .quantityMt(lotToMt(2)).efpDate(LocalDate.of(2025, 6, 25))
            .confirmationRef("SX-EFP-002").status(EFPTicketStatus.CONFIRMED)
            .entryPrice(new BigDecimal("4.52")).build());

        efpTicketRepository.save(EFPTicket.builder()
            .ticketRef("EFP-2025-003").hedgeTrade(ht5).physicalContract(pc6)
            .lots(2).futuresMonth("ZCZ25")
            .boardPrice(new BigDecimal("4.60")).basisValue(new BigDecimal("-0.16"))
            .quantityMt(lotToMt(2)).efpDate(LocalDate.of(2025, 7, 1))
            .confirmationRef("SX-EFP-003").status(EFPTicketStatus.CONFIRMED)
            .entryPrice(new BigDecimal("4.60")).build());

        efpTicketRepository.save(EFPTicket.builder()
            .ticketRef("EFP-2025-004").hedgeTrade(ht4).physicalContract(pc5)
            .lots(1).futuresMonth("ZCU25")
            .boardPrice(new BigDecimal("4.50")).basisValue(new BigDecimal("-0.22"))
            .quantityMt(lotToMt(1)).efpDate(LocalDate.of(2025, 7, 5))
            .confirmationRef("SX-EFP-004").status(EFPTicketStatus.PENDING)
            .entryPrice(new BigDecimal("4.50")).build());

        log.info("Seeded 4 EFP tickets");

        // ── Receipt Tickets (10 receipts) ──────────────────────────────────────────
        seedReceipts(gm1, vf1, pc1, pc2, pc3, pc4, pc6);
    }

    private void seedReceipts(Site gm1, Site vf1, PhysicalContract pc1, PhysicalContract pc2,
                              PhysicalContract pc3, PhysicalContract pc4, PhysicalContract pc6) {
        // GM1 receipts
        saveReceipt("RT-GM1-2025-001", pc1, gm1, LocalDate.of(2025, 7, 5),  "32.500", "15.2", "ON-7001");
        saveReceipt("RT-GM1-2025-002", pc1, gm1, LocalDate.of(2025, 7, 12), "28.100", "14.8", "ON-7002");
        saveReceipt("RT-GM1-2025-003", pc1, gm1, LocalDate.of(2025, 7, 19), "35.200", "16.1", "ON-7003");
        saveReceipt("RT-GM1-2025-004", pc2, gm1, LocalDate.of(2025, 8, 3),  "30.000", "15.5", "ON-8001");
        saveReceipt("RT-GM1-2025-005", pc2, gm1, LocalDate.of(2025, 8, 15), "27.400", "14.5", "ON-8002");
        saveReceipt("RT-GM1-2025-006", pc4, gm1, LocalDate.of(2025, 10, 2), "38.000", "15.8", "ON-1001");
        saveReceipt("RT-GM1-2025-007", pc6, gm1, LocalDate.of(2025, 12, 5), "25.600", "16.5", "ON-1201");

        // VF1 receipts
        saveReceipt("RT-VF1-2025-001", pc3, vf1, LocalDate.of(2025, 9, 8),  "33.200", "15.0", "QC-9001");
        saveReceipt("RT-VF1-2025-002", pc3, vf1, LocalDate.of(2025, 9, 18), "29.800", "16.8", "QC-9002");
        saveReceipt("RT-VF1-2025-003", pc3, vf1, LocalDate.of(2025, 9, 28), "36.500", "15.3", "QC-9003");

        log.info("Seeded 10 receipt tickets");
    }

    private void saveReceipt(String ticketRef, PhysicalContract contract, Site site,
                             LocalDate date, String grossStr, String moistureStr, String vehicleRef) {
        BigDecimal grossMt = new BigDecimal(grossStr);
        BigDecimal moisturePct = new BigDecimal(moistureStr);

        // Shrink: standard 15.5% base moisture
        BigDecimal shrinkFactor = BigDecimal.ZERO;
        double moisture = moisturePct.doubleValue();
        if (moisture > 15.5) {
            shrinkFactor = BigDecimal.valueOf((moisture - 15.5) * 1.183 / 100.0)
                .setScale(4, RoundingMode.HALF_UP);
        }

        BigDecimal netMt = grossMt.multiply(BigDecimal.ONE.subtract(shrinkFactor))
            .setScale(4, RoundingMode.HALF_UP);
        BigDecimal netBushels = netMt.multiply(BUSHELS_PER_MT).setScale(4, RoundingMode.HALF_UP);

        receiptTicketRepository.save(ReceiptTicket.builder()
            .ticketRef(ticketRef).physicalContract(contract).site(site)
            .receiptDate(date).grossMt(grossMt).netMt(netMt)
            .moisturePct(moisturePct).shrinkFactor(shrinkFactor)
            .netBushels(netBushels).vehicleRef(vehicleRef).build());
    }

    private void seedSettlePrices() {
        LocalDate settleDate = LocalDate.now();
        cornDailySettleRepository.saveAll(List.of(
            CornDailySettle.builder().futuresMonth("ZCN25").settleDate(settleDate).pricePerBushel(new BigDecimal("4.48")).build(),
            CornDailySettle.builder().futuresMonth("ZCU25").settleDate(settleDate).pricePerBushel(new BigDecimal("4.55")).build(),
            CornDailySettle.builder().futuresMonth("ZCZ25").settleDate(settleDate).pricePerBushel(new BigDecimal("4.65")).build(),
            CornDailySettle.builder().futuresMonth("ZCH26").settleDate(settleDate).pricePerBushel(new BigDecimal("4.72")).build(),
            CornDailySettle.builder().futuresMonth("ZCK26").settleDate(settleDate).pricePerBushel(new BigDecimal("4.80")).build(),
            CornDailySettle.builder().futuresMonth("ZCN26").settleDate(settleDate).pricePerBushel(new BigDecimal("4.95")).build()
        ));
        log.info("Seeded 6 corn settle prices");
    }

    private BigDecimal lotToMt(int lots) {
        return new BigDecimal(lots * BUSHELS_PER_LOT)
            .divide(BUSHELS_PER_MT, 4, RoundingMode.HALF_UP);
    }
}
