package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.ExportFilter;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {

    private final TradeRepository tradeRepo;
    private final PositionRepository positionRepo;
    private final RiskMetricRepository riskMetricRepo;
    private final AuditLogRepository auditLogRepo;

    // ------------------------------------------------------------------ CSV

    @Transactional(readOnly = true)
    public byte[] exportTradesToCsv(ExportFilter filter) throws IOException {
        List<Trade> trades = tradeRepo.findByFilter(
                filter.from(), filter.to(), filter.bookId(), filter.commodityId(), filter.counterpartyId());

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (CSVPrinter printer = new CSVPrinter(
                new OutputStreamWriter(out, StandardCharsets.UTF_8),
                CSVFormat.EXCEL.builder()
                        .setHeader("Trade Ref", "Type", "Status", "Counterparty", "Commodity", "Book",
                                   "Trade Date", "Start Date", "End Date", "Quantity", "Unit",
                                   "Pricing Type", "Fixed Price", "Price Index", "Spread",
                                   "Currency", "Notional USD", "MtM USD", "Unrealized P&L USD")
                        .build())) {
            for (Trade t : trades) {
                printer.printRecord(
                        t.getTradeReference(), t.getTradeType(), t.getStatus(),
                        t.getCounterparty().getShortName(), t.getCommodity().getCode(), t.getBook().getBookCode(),
                        t.getTradeDate(), t.getStartDate(), t.getEndDate(),
                        t.getQuantity(), t.getQuantityUnit(), t.getPricingType(), t.getFixedPrice(),
                        t.getPriceIndex() != null ? t.getPriceIndex().getIndexCode() : "",
                        t.getSpread(), t.getCurrency(), t.getNotionalUsd(), t.getMtmValueUsd(), t.getUnrealizedPnlUsd()
                );
            }
        }
        return out.toByteArray();
    }

    @Transactional(readOnly = true)
    public byte[] exportAuditLogToCsv(LocalDate from, LocalDate to) throws IOException {
        var fromInstant = from.atStartOfDay().toInstant(java.time.ZoneOffset.UTC);
        var toInstant   = to.plusDays(1).atStartOfDay().toInstant(java.time.ZoneOffset.UTC);
        var page = auditLogRepo.findByPerformedAtBetweenOrderByPerformedAtDesc(
                fromInstant, toInstant, PageRequest.of(0, 10_000));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (CSVPrinter printer = new CSVPrinter(
                new OutputStreamWriter(out, StandardCharsets.UTF_8),
                CSVFormat.EXCEL.builder()
                        .setHeader("ID", "Entity Type", "Entity ID", "Action", "Performed By",
                                   "Performed At", "Change Summary")
                        .build())) {
            for (AuditLog entry : page.getContent()) {
                printer.printRecord(
                        entry.getId(), entry.getEntityType(), entry.getEntityId(),
                        entry.getAction(), entry.getPerformedBy(), entry.getPerformedAt(),
                        entry.getChangeSummary()
                );
            }
        }
        return out.toByteArray();
    }

    // ------------------------------------------------------------------ Excel

    @Transactional(readOnly = true)
    public byte[] exportTradesToExcel(ExportFilter filter) throws IOException {
        List<Trade> trades = tradeRepo.findByFilter(
                filter.from(), filter.to(), filter.bookId(), filter.commodityId(), filter.counterpartyId());

        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            CellStyle headerStyle = buildHeaderStyle(wb);

            // Sheet 1: Trades
            Sheet tradesSheet = wb.createSheet("Trades");
            String[] tradeHeaders = {"Trade Ref", "Type", "Status", "Counterparty", "Commodity", "Book",
                    "Trade Date", "Start Date", "End Date", "Quantity", "Unit",
                    "Pricing Type", "Fixed Price", "Price Index", "Spread",
                    "Currency", "Notional USD", "MtM USD", "Unrealized P&L USD"};
            writeHeaderRow(tradesSheet, tradeHeaders, headerStyle);
            int rowIdx = 1;
            for (Trade t : trades) {
                Row row = tradesSheet.createRow(rowIdx++);
                int col = 0;
                row.createCell(col++).setCellValue(t.getTradeReference());
                row.createCell(col++).setCellValue(t.getTradeType().name());
                row.createCell(col++).setCellValue(t.getStatus().name());
                row.createCell(col++).setCellValue(t.getCounterparty().getShortName());
                row.createCell(col++).setCellValue(t.getCommodity().getCode());
                row.createCell(col++).setCellValue(t.getBook().getBookCode());
                row.createCell(col++).setCellValue(t.getTradeDate().toString());
                row.createCell(col++).setCellValue(t.getStartDate().toString());
                row.createCell(col++).setCellValue(t.getEndDate().toString());
                row.createCell(col++).setCellValue(t.getQuantity().doubleValue());
                row.createCell(col++).setCellValue(t.getQuantityUnit() != null ? t.getQuantityUnit().name() : "");
                row.createCell(col++).setCellValue(t.getPricingType().name());
                row.createCell(col++).setCellValue(t.getFixedPrice() != null ? t.getFixedPrice().doubleValue() : 0);
                row.createCell(col++).setCellValue(t.getPriceIndex() != null ? t.getPriceIndex().getIndexCode() : "");
                row.createCell(col++).setCellValue(t.getSpread() != null ? t.getSpread().doubleValue() : 0);
                row.createCell(col++).setCellValue(t.getCurrency());
                row.createCell(col++).setCellValue(t.getNotionalUsd() != null ? t.getNotionalUsd().doubleValue() : 0);
                row.createCell(col++).setCellValue(t.getMtmValueUsd() != null ? t.getMtmValueUsd().doubleValue() : 0);
                row.createCell(col).setCellValue(t.getUnrealizedPnlUsd() != null ? t.getUnrealizedPnlUsd().doubleValue() : 0);
            }
            autoSizeColumns(tradesSheet, tradeHeaders.length);

            // Sheet 2: Delivery Schedules
            Sheet deliverySheet = wb.createSheet("Delivery Schedules");
            String[] deliveryHeaders = {"Trade Ref", "Delivery Month", "Scheduled Qty", "Delivered Qty", "Status", "Location", "Nomination Ref"};
            writeHeaderRow(deliverySheet, deliveryHeaders, headerStyle);
            rowIdx = 1;
            for (Trade t : trades) {
                for (DeliverySchedule ds : t.getDeliverySchedules()) {
                    Row row = deliverySheet.createRow(rowIdx++);
                    int col = 0;
                    row.createCell(col++).setCellValue(t.getTradeReference());
                    row.createCell(col++).setCellValue(ds.getDeliveryMonth().toString());
                    row.createCell(col++).setCellValue(ds.getScheduledQuantity().doubleValue());
                    row.createCell(col++).setCellValue(ds.getDeliveredQuantity() != null ? ds.getDeliveredQuantity().doubleValue() : 0);
                    row.createCell(col++).setCellValue(ds.getStatus().name());
                    row.createCell(col++).setCellValue(ds.getDeliveryLocation() != null ? ds.getDeliveryLocation() : "");
                    row.createCell(col).setCellValue(ds.getNominationRef() != null ? ds.getNominationRef() : "");
                }
            }
            autoSizeColumns(deliverySheet, deliveryHeaders.length);

            // Sheet 3: Risk Metrics (today's snapshot)
            Sheet riskSheet = wb.createSheet("Risk Metrics");
            String[] riskHeaders = {"Date", "Metric Type", "Value", "Currency", "Methodology"};
            writeHeaderRow(riskSheet, riskHeaders, headerStyle);
            rowIdx = 1;
            List<RiskMetric> metrics = riskMetricRepo.findByMetricDate(LocalDate.now());
            for (RiskMetric m : metrics) {
                Row row = riskSheet.createRow(rowIdx++);
                int col = 0;
                row.createCell(col++).setCellValue(m.getMetricDate().toString());
                row.createCell(col++).setCellValue(m.getMetricType().name());
                row.createCell(col++).setCellValue(m.getMetricValue() != null ? m.getMetricValue().doubleValue() : 0);
                row.createCell(col++).setCellValue(m.getCurrency() != null ? m.getCurrency() : "");
                row.createCell(col).setCellValue(m.getMethodology() != null ? m.getMethodology() : "");
            }
            autoSizeColumns(riskSheet, riskHeaders.length);

            // Sheet 4: Summary
            Sheet summarySheet = wb.createSheet("Summary");
            summarySheet.createRow(0).createCell(0).setCellValue("HedgeLab Export");
            summarySheet.createRow(1).createCell(0).setCellValue("Generated: " + LocalDate.now());
            summarySheet.createRow(2).createCell(0).setCellValue("Trades: " + trades.size());
            summarySheet.createRow(3).createCell(0).setCellValue("Risk Metrics: " + metrics.size());

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    // ------------------------------------------------------------------ helpers

    private CellStyle buildHeaderStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.CORNFLOWER_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private void writeHeaderRow(Sheet sheet, String[] headers, CellStyle style) {
        Row row = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = row.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(style);
        }
    }

    private void autoSizeColumns(Sheet sheet, int columnCount) {
        for (int i = 0; i < columnCount; i++) {
            sheet.autoSizeColumn(i);
        }
    }
}
