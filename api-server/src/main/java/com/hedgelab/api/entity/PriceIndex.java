package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "price_indices", uniqueConstraints = @UniqueConstraint(name = "uq_index_code", columnNames = "index_code"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PriceIndex extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "price_index_seq")
    @SequenceGenerator(name = "price_index_seq", sequenceName = "price_index_id_seq", allocationSize = 1)
    private Long id;

    @Column(name = "index_code", length = 50, nullable = false)
    private String indexCode;

    @Column(name = "display_name", length = 100, nullable = false)
    private String displayName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "commodity_id", nullable = false)
    private Commodity commodity;

    @Column(name = "provider", length = 50)
    private String provider;

    @Column(name = "currency", length = 3, nullable = false)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "unit", length = 20)
    private UnitOfMeasure unit;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "description", length = 500)
    private String description;
}
