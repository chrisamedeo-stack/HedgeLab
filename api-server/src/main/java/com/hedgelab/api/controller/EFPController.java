package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreateEFPRequest;
import com.hedgelab.api.dto.response.EFPTicketResponse;
import com.hedgelab.api.service.CommoditySpecService;
import com.hedgelab.api.service.EFPService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/{commodity}/efp")
@RequiredArgsConstructor
public class EFPController {
    private final EFPService service;
    private final CommoditySpecService specService;

    @GetMapping
    public List<EFPTicketResponse> getAll(@PathVariable String commodity) {
        String code = specService.resolveSlug(commodity);
        return service.getAllEFPs(code);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EFPTicketResponse create(@PathVariable String commodity,
                                     @RequestBody CreateEFPRequest req) {
        specService.resolveSlug(commodity);
        return service.create(req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String commodity, @PathVariable Long id) {
        specService.resolveSlug(commodity);
        service.delete(id);
    }
}
