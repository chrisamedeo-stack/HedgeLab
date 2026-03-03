package com.hedgelab.v2.service.kernel;

import com.hedgelab.v2.entity.kernel.ContractCalendar;
import com.hedgelab.v2.repository.kernel.ContractCalendarRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ContractCalendarService {

    private final ContractCalendarRepository contractCalendarRepository;

    public List<ContractCalendar> list(String commodityId, boolean activeOnly) {
        if (activeOnly) {
            return contractCalendarRepository.findByCommodityIdAndIsActiveTrueOrderByContractMonth(commodityId);
        }
        return contractCalendarRepository.findByCommodityIdOrderByContractMonth(commodityId);
    }

    public ContractCalendar upsert(ContractCalendar cal) {
        Optional<ContractCalendar> existing = contractCalendarRepository
                .findByCommodityIdAndContractMonth(cal.getCommodityId(), cal.getContractMonth());
        if (existing.isPresent()) {
            ContractCalendar e = existing.get();
            if (cal.getFirstNoticeDate() != null) e.setFirstNoticeDate(cal.getFirstNoticeDate());
            if (cal.getLastTradeDate() != null) e.setLastTradeDate(cal.getLastTradeDate());
            if (cal.getExpirationDate() != null) e.setExpirationDate(cal.getExpirationDate());
            if (cal.getFirstDeliveryDate() != null) e.setFirstDeliveryDate(cal.getFirstDeliveryDate());
            if (cal.getLastDeliveryDate() != null) e.setLastDeliveryDate(cal.getLastDeliveryDate());
            if (cal.getSource() != null) e.setSource(cal.getSource());
            return contractCalendarRepository.save(e);
        }
        return contractCalendarRepository.save(cal);
    }
}
