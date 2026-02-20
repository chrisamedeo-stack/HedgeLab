package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "audit_log",
       indexes = {
           @Index(name = "idx_audit_entity", columnList = "entity_type, entity_id"),
           @Index(name = "idx_audit_performed_at", columnList = "performed_at"),
           @Index(name = "idx_audit_performed_by", columnList = "performed_by")
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "audit_log_id_seq")
    @SequenceGenerator(name = "audit_log_id_seq", sequenceName = "audit_log_id_seq", allocationSize = 1)
    private Long id;

    @Column(name = "entity_type", length = 100, nullable = false)
    private String entityType;

    @Column(name = "entity_id")
    private Long entityId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", length = 20, nullable = false)
    private AuditAction action;

    @Column(name = "performed_by", length = 100)
    private String performedBy;

    @Column(name = "performed_at", nullable = false)
    @Builder.Default
    private Instant performedAt = Instant.now();

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    @Column(name = "change_summary", length = 500)
    private String changeSummary;
}
