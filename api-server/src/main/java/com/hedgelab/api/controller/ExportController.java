package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.ExportFilter;
import com.hedgelab.api.service.ExportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/exports")
@RequiredArgsConstructor
@Tag(name = "Exports", description = "CSV and Excel data exports")
public class ExportController {

    private final ExportService exportService;

    @GetMapping("/trades.csv")
    @Operation(summary = "Export trades to CSV")
    public ResponseEntity<byte[]> tradesToCsv(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long bookId,
            @RequestParam(required = false) Long commodityId,
            @RequestParam(required = false) Long counterpartyId) throws IOException {

        ExportFilter filter = new ExportFilter(from, to, bookId, commodityId, counterpartyId);
        byte[] data = exportService.exportTradesToCsv(filter);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"trades_" + LocalDate.now() + ".csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(data);
    }

    @GetMapping("/trades.xlsx")
    @Operation(summary = "Export trades to Excel (multi-sheet)")
    public ResponseEntity<byte[]> tradesToExcel(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long bookId,
            @RequestParam(required = false) Long commodityId,
            @RequestParam(required = false) Long counterpartyId) throws IOException {

        ExportFilter filter = new ExportFilter(from, to, bookId, commodityId, counterpartyId);
        byte[] data = exportService.exportTradesToExcel(filter);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"trades_" + LocalDate.now() + ".xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }

    @GetMapping("/audit-log.csv")
    @Operation(summary = "Export audit log to CSV (ADMIN only)")
    public ResponseEntity<byte[]> auditLogToCsv(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to)
            throws IOException {

        LocalDate effectiveFrom = from != null ? from : LocalDate.now().minusMonths(3);
        LocalDate effectiveTo   = to   != null ? to   : LocalDate.now();
        byte[] data = exportService.exportAuditLogToCsv(effectiveFrom, effectiveTo);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"audit_log_" + LocalDate.now() + ".csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(data);
    }
}
