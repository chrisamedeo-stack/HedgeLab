package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.Book;

public record BookResponse(
    Long id,
    String bookCode,
    String displayName,
    String tradingDesk,
    String description,
    boolean active
) {
    public static BookResponse from(Book b) {
        return new BookResponse(b.getId(), b.getBookCode(), b.getDisplayName(),
            b.getTradingDesk(), b.getDescription(), b.isActive());
    }
}
