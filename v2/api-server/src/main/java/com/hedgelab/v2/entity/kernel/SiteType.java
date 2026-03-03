package com.hedgelab.v2.entity.kernel;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "site_types")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SiteType {

    @Id
    @Column(length = 50)
    private String id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "operating_model", nullable = false, length = 20)
    private String operatingModel;

    @Column(name = "supported_commodities", columnDefinition = "text[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] supportedCommodities;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> features = Map.of();

    @Column(name = "position_sections", columnDefinition = "text[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private String[] positionSections;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "kpi_config", columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> kpiConfig = Map.of();

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
