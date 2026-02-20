package com.hedgelab.api.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hedgelab.api.entity.AppSetting;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.AppSettingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AppSettingService {

    private final AppSettingRepository repo;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<AppSetting> getAll() {
        return repo.findAll();
    }

    @Transactional(readOnly = true)
    public AppSetting get(String key) {
        return repo.findBySettingKey(key)
                .orElseThrow(() -> new ResourceNotFoundException("Setting", key));
    }

    @Transactional
    public AppSetting upsert(String key, String value) {
        AppSetting setting = repo.findBySettingKey(key).orElse(null);
        if (setting == null) {
            setting = AppSetting.builder()
                    .settingKey(key)
                    .value(value)
                    .build();
        } else {
            setting.setValue(value);
        }
        return repo.save(setting);
    }

    public int getFiscalYearStartMonth() {
        try {
            return Integer.parseInt(get("FISCAL_YEAR_START_MONTH").getValue());
        } catch (Exception e) {
            log.warn("Could not read FISCAL_YEAR_START_MONTH, defaulting to 7: {}", e.getMessage());
            return 7;
        }
    }

    public Map<String, List<Integer>> getFuturesMonthMappings() {
        try {
            String json = get("FUTURES_MONTH_MAPPINGS").getValue();
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Could not parse FUTURES_MONTH_MAPPINGS, returning defaults: {}", e.getMessage());
            return Map.of(
                    "H", List.of(12, 1, 2),
                    "K", List.of(3, 4),
                    "N", List.of(5, 6),
                    "U", List.of(7, 8),
                    "Z", List.of(9, 10, 11)
            );
        }
    }
}
