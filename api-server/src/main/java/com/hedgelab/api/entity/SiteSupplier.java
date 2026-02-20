package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "site_suppliers", uniqueConstraints = @UniqueConstraint(columnNames = {"site_id", "supplier_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SiteSupplier {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "site_id", nullable = false)
    private Site site;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;
}
