package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "corn_sites")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Site extends AuditableEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(unique = true, nullable = false, length = 10)
    private String code; // GM1, VF1
    @Column(nullable = false)
    private String name; // Gimli, Valleyfield
    private String country; // Canada
    private String province; // MB, QC
}
