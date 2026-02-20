package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "counterparties",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_cp_code",       columnNames = "legal_entity_code"),
        @UniqueConstraint(name = "uq_cp_short_name", columnNames = "short_name")
    })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Counterparty extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "counterparty_seq")
    @SequenceGenerator(name = "counterparty_seq", sequenceName = "counterparty_id_seq", allocationSize = 1)
    private Long id;

    @Column(name = "legal_entity_code", length = 30, nullable = false)
    private String legalEntityCode;

    @Column(name = "lei", length = 20)
    private String legalEntityIdentifier;

    @Column(name = "short_name", length = 50, nullable = false)
    private String shortName;

    @Column(name = "full_legal_name", length = 200, nullable = false)
    private String fullLegalName;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", length = 25, nullable = false)
    private CounterpartyType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    @Builder.Default
    private CounterpartyStatus status = CounterpartyStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "credit_rating", length = 10)
    private CreditRating creditRating;

    @Column(name = "credit_limit_usd", precision = 22, scale = 2)
    @Builder.Default
    private BigDecimal creditLimitUsd = BigDecimal.ZERO;

    @Column(name = "current_exposure_usd", precision = 22, scale = 2)
    @Builder.Default
    private BigDecimal currentExposureUsd = BigDecimal.ZERO;

    @Column(name = "country", length = 2)
    private String country;

    @Column(name = "registration_number", length = 50)
    private String registrationNumber;

    @Column(name = "contact_email", length = 150)
    private String contactEmail;

    @Column(name = "contact_phone", length = 30)
    private String contactPhone;

    @Column(name = "onboarded_date")
    private LocalDate onboardedDate;

    @Column(name = "last_review_date")
    private LocalDate lastReviewDate;

    @Column(name = "internal_notes", length = 2000)
    private String internalNotes;
}
