package com.hedgelab.api.util;

import com.hedgelab.api.entity.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Static factory helpers for building test entities.
 */
public final class TestDataBuilder {

    private TestDataBuilder() {}

    public static Commodity aCommodity() {
        Commodity c = new Commodity();
        c.setCode("TEST-CRUDE");
        c.setName("Test Crude Oil");
        c.setCategory(CommodityCategory.ENERGY);
        c.setUnitOfMeasure(UnitOfMeasure.BBL);
        c.setCurrency("USD");
        c.setHedgeable(true);
        c.setActive(true);
        return c;
    }

    public static Counterparty aCounterparty() {
        Counterparty cp = new Counterparty();
        cp.setLegalEntityCode("TEST-CP-001");
        cp.setShortName("Test CP");
        cp.setFullLegalName("Test Counterparty Ltd");
        cp.setType(CounterpartyType.TRADER);
        cp.setStatus(CounterpartyStatus.ACTIVE);
        cp.setCreditLimitUsd(new BigDecimal("100000000"));
        cp.setCurrentExposureUsd(BigDecimal.ZERO);
        cp.setCountry("US");
        return cp;
    }

    public static Book aBook() {
        Book b = new Book();
        b.setBookCode("TEST-BOOK");
        b.setDisplayName("Test Book");
        b.setTradingDesk("Test Desk");
        b.setActive(true);
        return b;
    }

    public static PriceIndex aPriceIndex(Commodity commodity) {
        PriceIndex pi = new PriceIndex();
        pi.setIndexCode("TEST-IDX-1M");
        pi.setDisplayName("Test Index Front Month");
        pi.setCommodity(commodity);
        pi.setProvider("TEST");
        pi.setCurrency("USD");
        pi.setUnit(UnitOfMeasure.BBL);
        pi.setActive(true);
        return pi;
    }

    public static DailyPrice aDailyPrice(PriceIndex index, LocalDate date, BigDecimal price) {
        DailyPrice dp = new DailyPrice();
        dp.setPriceIndex(index);
        dp.setPriceDate(date);
        dp.setPrice(price);
        dp.setPriceType("SETTLE");
        dp.setSource("TEST");
        dp.setConfirmed(true);
        return dp;
    }

    public static AppUser anAdminUser() {
        return AppUser.builder()
                .username("test_admin")
                .email("admin@test.com")
                .passwordHash("$2b$10$irrelevant_hash_for_tests")
                .role(AppRole.ADMIN)
                .enabled(true)
                .build();
    }

    public static AppUser aTraderUser() {
        return AppUser.builder()
                .username("test_trader")
                .email("trader@test.com")
                .passwordHash("$2b$10$irrelevant_hash_for_tests")
                .role(AppRole.TRADER)
                .enabled(true)
                .build();
    }
}
