package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "books", uniqueConstraints = @UniqueConstraint(name = "uq_book_code", columnNames = "book_code"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Book extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "book_seq")
    @SequenceGenerator(name = "book_seq", sequenceName = "book_id_seq", allocationSize = 1)
    private Long id;

    @Column(name = "book_code", length = 20, nullable = false)
    private String bookCode;

    @Column(name = "display_name", length = 100, nullable = false)
    private String displayName;

    @Column(name = "trading_desk", length = 50)
    private String tradingDesk;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;
}
