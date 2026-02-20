package com.hedgelab.api.service;

import com.hedgelab.api.dto.response.PositionResponse;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.repository.PositionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.YearMonth;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PositionService {

    private final PositionRepository positionRepo;

    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public void updatePosition(Trade trade, boolean reverse) {
        boolean isBuy = trade.getTradeType() == TradeType.PHYSICAL_BUY
            || trade.getTradeType() == TradeType.FINANCIAL_BUY;
        PositionType posType = trade.getTradeType() == TradeType.PHYSICAL_BUY
            || trade.getTradeType() == TradeType.PHYSICAL_SELL ? PositionType.PHYSICAL : PositionType.PAPER;

        for (DeliverySchedule schedule : trade.getDeliverySchedules()) {
            BigDecimal qty = schedule.getScheduledQuantity();
            if (reverse) qty = qty.negate();

            Position pos = positionRepo.findForUpdate(
                trade.getBook(), trade.getCommodity(), schedule.getDeliveryMonth(), posType
            ).orElseGet(() -> Position.builder()
                .book(trade.getBook())
                .commodity(trade.getCommodity())
                .deliveryMonth(schedule.getDeliveryMonth())
                .positionType(posType)
                .quantityUnit(trade.getQuantityUnit())
                .build());

            if (isBuy) {
                BigDecimal newLong = pos.getLongQuantity().add(qty);
                pos.setLongQuantity(newLong.max(BigDecimal.ZERO));
            } else {
                BigDecimal newShort = pos.getShortQuantity().add(qty);
                pos.setShortQuantity(newShort.max(BigDecimal.ZERO));
            }
            pos.setNetQuantity(pos.getLongQuantity().subtract(pos.getShortQuantity()));
            pos.setLastUpdated(Instant.now());
            positionRepo.save(pos);
        }
    }

    @Transactional(readOnly = true)
    public List<PositionResponse> getPositionsByBook(Long bookId, YearMonth fromMonth, YearMonth toMonth) {
        Book book = new Book();
        book.setId(bookId);
        return positionRepo.findByBookAndDeliveryMonthBetweenOrderByDeliveryMonthAsc(book, fromMonth, toMonth)
            .stream().map(PositionResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<PositionResponse> getNetPositionsByCommodity(Long commodityId, YearMonth month) {
        Commodity commodity = new Commodity();
        commodity.setId(commodityId);
        return positionRepo.findByCommodityAndDeliveryMonth(commodity, month)
            .stream().map(PositionResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<PositionResponse> getBookPositions(Long bookId) {
        Book book = new Book();
        book.setId(bookId);
        return positionRepo.findByBook(book).stream().map(PositionResponse::from).toList();
    }
}
