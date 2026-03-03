package com.hedgelab.v2.service.kernel;

import com.hedgelab.v2.entity.kernel.OrgSetting;
import com.hedgelab.v2.exception.ResourceNotFoundException;
import com.hedgelab.v2.repository.kernel.OrgSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrgSettingsService {

    private final OrgSettingRepository orgSettingRepository;

    public OrgSetting get(UUID orgId) {
        return orgSettingRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("OrgSettings", orgId));
    }

    public OrgSetting update(UUID orgId, OrgSetting updates) {
        OrgSetting existing = get(orgId);
        if (updates.getDefaultCurrency() != null) existing.setDefaultCurrency(updates.getDefaultCurrency());
        if (updates.getReportingCurrency() != null) existing.setReportingCurrency(updates.getReportingCurrency());
        if (updates.getFiscalYearStart() != null) existing.setFiscalYearStart(updates.getFiscalYearStart());
        if (updates.getDateFormat() != null) existing.setDateFormat(updates.getDateFormat());
        if (updates.getNumberFormat() != null) existing.setNumberFormat(updates.getNumberFormat());
        if (updates.getTimezone() != null) existing.setTimezone(updates.getTimezone());
        if (updates.getDefaultExchange() != null) existing.setDefaultExchange(updates.getDefaultExchange());
        if (updates.getDefaultBroker() != null) existing.setDefaultBroker(updates.getDefaultBroker());
        if (updates.getDefaultAccount() != null) existing.setDefaultAccount(updates.getDefaultAccount());
        if (updates.getMtmAutoRun() != null) existing.setMtmAutoRun(updates.getMtmAutoRun());
        if (updates.getRollCriticalDays() != null) existing.setRollCriticalDays(updates.getRollCriticalDays());
        if (updates.getRollUrgentDays() != null) existing.setRollUrgentDays(updates.getRollUrgentDays());
        if (updates.getRollUpcomingDays() != null) existing.setRollUpcomingDays(updates.getRollUpcomingDays());
        if (updates.getRollAutoNotify() != null) existing.setRollAutoNotify(updates.getRollAutoNotify());
        if (updates.getRollDefaultTarget() != null) existing.setRollDefaultTarget(updates.getRollDefaultTarget());
        if (updates.getRollBudgetMonthPolicy() != null) existing.setRollBudgetMonthPolicy(updates.getRollBudgetMonthPolicy());
        if (updates.getRollCostAllocation() != null) existing.setRollCostAllocation(updates.getRollCostAllocation());
        existing.setUpdatedAt(Instant.now());
        return orgSettingRepository.save(existing);
    }
}
