package com.hedgelab.api.repository;

import com.hedgelab.api.entity.PriceFormula;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PriceFormulaRepository extends JpaRepository<PriceFormula, Long> {
    Optional<PriceFormula> findByFormulaCode(String formulaCode);
    boolean existsByFormulaCode(String formulaCode);
    List<PriceFormula> findByActive(boolean active);
}
