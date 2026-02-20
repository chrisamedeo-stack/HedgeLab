package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.UpdateSettingRequest;
import com.hedgelab.api.entity.AppSetting;
import com.hedgelab.api.service.AppSettingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final AppSettingService settingService;

    @GetMapping
    public List<AppSetting> getAll() {
        return settingService.getAll();
    }

    @GetMapping("/{key}")
    public AppSetting getByKey(@PathVariable String key) {
        return settingService.get(key);
    }

    @PutMapping("/{key}")
    public AppSetting upsert(@PathVariable String key, @Valid @RequestBody UpdateSettingRequest req) {
        return settingService.upsert(key, req.value());
    }
}
