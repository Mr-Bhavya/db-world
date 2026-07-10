package com.db.dbworld.app.wallet.controller;

import com.db.dbworld.app.wallet.dto.CreateShareRequest;
import com.db.dbworld.app.wallet.dto.ShareDto;
import com.db.dbworld.app.wallet.service.WalletShareService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.role.annotations.AnyRole;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
@AnyRole
public class WalletShareController {

    private final WalletShareService shareService;
    private final UserContext userContext;

    @PostMapping("/documents/{id}/shares")
    public ApiResponse<ShareDto> create(@PathVariable String id, @Valid @RequestBody CreateShareRequest req) {
        return ApiResponse.success("Share link created", shareService.create(userContext.userId(), id, req));
    }

    @GetMapping("/documents/{id}/shares")
    public ApiResponse<List<ShareDto>> list(@PathVariable String id) {
        return ApiResponse.success(shareService.listForDocument(userContext.userId(), id));
    }

    @DeleteMapping("/shares/{shareId}")
    public ApiResponse<Void> revoke(@PathVariable String shareId) {
        shareService.revoke(userContext.userId(), shareId);
        return ApiResponse.success("Share link revoked");
    }
}
