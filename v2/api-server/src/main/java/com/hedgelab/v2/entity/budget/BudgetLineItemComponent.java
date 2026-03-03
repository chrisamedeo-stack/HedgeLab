package com.hedgelab.v2.entity.budget;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "bgt_line_item_components")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BudgetLineItemComponent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "line_item_id", nullable = false)
    private UUID lineItemId;

    @Column(name = "component_name", nullable = false, length = 100)
    private String componentName;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String unit = "$/bu";

    @Column(name = "target_value", nullable = false)
    @Builder.Default
    private BigDecimal targetValue = BigDecimal.ZERO;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private int displayOrder = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
