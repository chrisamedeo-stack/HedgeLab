package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "site_commodities", uniqueConstraints = @UniqueConstraint(columnNames = {"site_id", "commodity_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SiteCommodity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "site_id", nullable = false)
    private Site site;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "commodity_id", nullable = false)
    private Commodity commodity;
}
