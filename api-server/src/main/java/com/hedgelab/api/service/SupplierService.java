package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.CreateSupplierRequest;
import com.hedgelab.api.dto.response.SupplierResponse;
import com.hedgelab.api.entity.Supplier;
import com.hedgelab.api.exception.InvalidStateException;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SupplierService {
    private final SupplierRepository supplierRepository;

    @Transactional(readOnly = true)
    public List<SupplierResponse> getAllSuppliers() {
        return supplierRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SupplierResponse> getActiveSuppliers() {
        return supplierRepository.findByActiveTrue().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public SupplierResponse create(CreateSupplierRequest req) {
        if (supplierRepository.findByCode(req.code().toUpperCase()).isPresent()) {
            throw new InvalidStateException("Supplier code already exists: " + req.code());
        }
        Supplier supplier = Supplier.builder()
                .code(req.code().toUpperCase())
                .name(req.name())
                .country(req.country())
                .contactEmail(req.contactEmail())
                .contactPhone(req.contactPhone())
                .build();
        return toResponse(supplierRepository.save(supplier));
    }

    @Transactional
    public SupplierResponse update(Long id, CreateSupplierRequest req) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", id));
        if (!supplier.getCode().equals(req.code().toUpperCase())
                && supplierRepository.findByCode(req.code().toUpperCase()).isPresent()) {
            throw new InvalidStateException("Supplier code already in use: " + req.code());
        }
        supplier.setCode(req.code().toUpperCase());
        supplier.setName(req.name());
        supplier.setCountry(req.country());
        supplier.setContactEmail(req.contactEmail());
        supplier.setContactPhone(req.contactPhone());
        return toResponse(supplierRepository.save(supplier));
    }

    @Transactional
    public void deactivate(Long id) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", id));
        supplier.setActive(false);
        supplierRepository.save(supplier);
    }

    @Transactional
    public void activate(Long id) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier", id));
        supplier.setActive(true);
        supplierRepository.save(supplier);
    }

    private SupplierResponse toResponse(Supplier s) {
        return SupplierResponse.builder()
                .id(s.getId())
                .code(s.getCode())
                .name(s.getName())
                .country(s.getCountry())
                .contactEmail(s.getContactEmail())
                .contactPhone(s.getContactPhone())
                .active(s.isActive())
                .build();
    }
}
