package com.db.dbworld.app.wallet.controller;

import com.db.dbworld.app.wallet.dto.SharedDocumentInfoDto;
import com.db.dbworld.app.wallet.dto.WalletContent;
import com.db.dbworld.app.wallet.service.WalletShareService;
import com.db.dbworld.payloads.ApiResponse;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wallet/shared")
@RequiredArgsConstructor
public class WalletSharePublicController {

    private final WalletShareService shareService;

    @GetMapping("/{token}/info")
    public ApiResponse<SharedDocumentInfoDto> info(@PathVariable String token) {
        return ApiResponse.success(shareService.resolveInfo(token));
    }

    @GetMapping("/{token}/content")
    public void content(@PathVariable String token,
                        @RequestParam(defaultValue = "inline") String disposition,
                        HttpServletResponse response) {
        WalletContent content = shareService.resolveContent(token);
        WalletContentWriter.write(response, content, !"attachment".equalsIgnoreCase(disposition));
    }
}
