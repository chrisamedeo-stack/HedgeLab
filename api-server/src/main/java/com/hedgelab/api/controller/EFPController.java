package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreateEFPRequest;
import com.hedgelab.api.dto.response.EFPTicketResponse;
import com.hedgelab.api.service.EFPService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/corn/efp")
@RequiredArgsConstructor
public class EFPController {
    private final EFPService service;

    @GetMapping
    public List<EFPTicketResponse> getAll() {
        return service.getAllEFPs();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EFPTicketResponse create(@RequestBody CreateEFPRequest req) {
        return service.create(req);
    }
}
