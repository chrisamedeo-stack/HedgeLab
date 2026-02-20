package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.CreateFormulaRequest;
import com.hedgelab.api.entity.FormulaComponent;
import com.hedgelab.api.entity.PriceFormula;
import com.hedgelab.api.entity.PriceIndex;
import com.hedgelab.api.exception.InvalidStateException;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.PriceFormulaRepository;
import com.hedgelab.api.repository.PriceIndexRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FormulaService {

    private final PriceFormulaRepository formulaRepo;
    private final PriceIndexRepository priceIndexRepo;

    @Transactional
    public PriceFormula create(CreateFormulaRequest req) {
        if (formulaRepo.existsByFormulaCode(req.formulaCode())) {
            throw new InvalidStateException("Formula code already exists: " + req.formulaCode());
        }
        PriceFormula formula = PriceFormula.builder()
            .formulaCode(req.formulaCode().toUpperCase())
            .displayName(req.displayName())
            .description(req.description())
            .build();

        List<FormulaComponent> components = new ArrayList<>();
        for (CreateFormulaRequest.ComponentRequest cr : req.components()) {
            PriceIndex refIndex = null;
            if (cr.referenceIndexId() != null) {
                refIndex = priceIndexRepo.findById(cr.referenceIndexId())
                    .orElseThrow(() -> new ResourceNotFoundException("PriceIndex", cr.referenceIndexId()));
            }
            FormulaComponent fc = FormulaComponent.builder()
                .formula(formula)
                .sequenceOrder(cr.sequenceOrder())
                .componentLabel(cr.componentLabel())
                .componentType(cr.componentType())
                .weight(cr.weight())
                .referenceIndex(refIndex)
                .fixedValue(cr.fixedValue())
                .cap(cr.cap())
                .floor(cr.floor())
                .build();
            components.add(fc);
        }
        formula.setComponents(components);
        return formulaRepo.save(formula);
    }

    @Transactional(readOnly = true)
    public List<PriceFormula> getAll() {
        return formulaRepo.findByActive(true);
    }

    @Transactional(readOnly = true)
    public PriceFormula getById(Long id) {
        return formulaRepo.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("PriceFormula", id));
    }

    @Transactional
    public void deactivate(Long id) {
        PriceFormula f = getById(id);
        f.setActive(false);
        formulaRepo.save(f);
    }
}
