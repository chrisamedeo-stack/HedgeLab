package com.hedgelab.v2.entity.kernel;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "site_groups")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SiteGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "group_type", nullable = false, length = 30)
    private String groupType;

    @Column(name = "parent_id")
    private UUID parentId;

    @Column(name = "sort_order")
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "site_group_members",
        joinColumns = @JoinColumn(name = "site_group_id"),
        inverseJoinColumns = @JoinColumn(name = "site_id")
    )
    @Builder.Default
    @JsonIgnore
    private List<Site> sites = new ArrayList<>();
}
