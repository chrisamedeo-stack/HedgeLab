package com.hedgelab.v2.controller.kernel;

import com.hedgelab.v2.entity.kernel.SiteType;
import com.hedgelab.v2.repository.kernel.SiteTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v2/kernel/site-types")
@RequiredArgsConstructor
public class SiteTypeController {

    private final SiteTypeRepository siteTypeRepository;

    @GetMapping
    public List<SiteType> list() {
        return siteTypeRepository.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SiteType create(@RequestBody SiteType siteType) {
        return siteTypeRepository.save(siteType);
    }
}
