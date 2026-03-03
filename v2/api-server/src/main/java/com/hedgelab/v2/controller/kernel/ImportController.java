package com.hedgelab.v2.controller.kernel;

import com.hedgelab.v2.entity.kernel.ImportJob;
import com.hedgelab.v2.exception.ResourceNotFoundException;
import com.hedgelab.v2.repository.kernel.ImportJobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/kernel/import")
@RequiredArgsConstructor
public class ImportController {

    private final ImportJobRepository importJobRepository;

    @GetMapping
    public Object list(@RequestParam(required = false) String orgId,
                       @RequestParam(required = false) String jobId) {
        if (jobId != null) {
            ImportJob job = importJobRepository.findById(UUID.fromString(jobId))
                    .orElseThrow(() -> new ResourceNotFoundException("ImportJob", jobId));
            return job;
        }
        if (orgId != null) {
            return importJobRepository.findByOrgIdOrderByCreatedAtDesc(UUID.fromString(orgId));
        }
        return List.of();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Object action(@RequestBody Map<String, Object> body) {
        String action = (String) body.get("action");
        if ("targets".equals(action)) {
            return getSupportedTargets();
        }
        if ("create".equals(action)) {
            ImportJob job = ImportJob.builder()
                    .orgId(UUID.fromString((String) body.get("orgId")))
                    .userId(UUID.fromString((String) body.get("userId")))
                    .targetModule((String) body.get("targetModule"))
                    .targetTable((String) body.get("targetTable"))
                    .fileName((String) body.get("fileName"))
                    .fileType((String) body.get("fileType"))
                    .build();
            return importJobRepository.save(job);
        }
        return Map.of("error", "Unknown action: " + action);
    }

    private List<Map<String, Object>> getSupportedTargets() {
        return List.of(
            Map.of("module", "trade_capture", "table", "tc_financial_trades", "label", "Financial Trades"),
            Map.of("module", "position_manager", "table", "pm_allocations", "label", "Allocations"),
            Map.of("module", "position_manager", "table", "pm_physical_positions", "label", "Physical Positions"),
            Map.of("module", "budget", "table", "bgt_line_items", "label", "Budget Line Items"),
            Map.of("module", "market_data", "table", "md_prices", "label", "Market Prices")
        );
    }
}
