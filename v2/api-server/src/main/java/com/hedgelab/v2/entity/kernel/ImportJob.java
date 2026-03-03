package com.hedgelab.v2.entity.kernel;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "import_jobs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ImportJob {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "target_module", nullable = false, length = 30)
    private String targetModule;

    @Column(name = "target_table", nullable = false, length = 50)
    private String targetTable;

    @Column(name = "file_name", nullable = false, length = 500)
    private String fileName;

    @Column(name = "file_type", nullable = false, length = 20)
    private String fileType;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "file_path", length = 500)
    private String filePath;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "uploaded";

    @Column(name = "ai_model", length = 50)
    private String aiModel;

    @Column(name = "ai_prompt_used", columnDefinition = "text")
    private String aiPromptUsed;

    @Column(name = "ai_raw_response", columnDefinition = "text")
    private String aiRawResponse;

    @Column(name = "total_rows")
    @Builder.Default
    private Integer totalRows = 0;

    @Column(name = "valid_rows")
    @Builder.Default
    private Integer validRows = 0;

    @Column(name = "error_rows")
    @Builder.Default
    private Integer errorRows = 0;

    @Column(name = "warning_rows")
    @Builder.Default
    private Integer warningRows = 0;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "column_mapping", columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> columnMapping = Map.of();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "validation_summary", columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> validationSummary = Map.of();

    @Column(name = "reviewed_by")
    private UUID reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "review_notes", columnDefinition = "text")
    private String reviewNotes;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
