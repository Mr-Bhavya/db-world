package com.db.dbworld.app.ipo.controller;

import com.db.dbworld.app.ipo.dto.IpoApplicationDto;
import com.db.dbworld.app.ipo.dto.IpoSummaryDto;
import com.db.dbworld.app.ipo.dto.MyIpoDto;
import com.db.dbworld.app.ipo.dto.SaveApplicationRequest;
import com.db.dbworld.app.ipo.service.IpoApplicationService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.payloads.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IpoApplicationControllerTest {

    private static final Long USER_ID = 42L;
    private static final Long OTHER_USER_ID = 99L;

    IpoApplicationService applicationService;
    UserContext userContext;
    IpoApplicationController controller;

    @BeforeEach
    void setUp() {
        applicationService = mock(IpoApplicationService.class);
        userContext = mock(UserContext.class);
        controller = new IpoApplicationController(applicationService, userContext);
    }

    private SaveApplicationRequest request() {
        return new SaveApplicationRequest("Jane Doe", "APP123", "DP456", "ABCDE1234F", "unknown");
    }

    private IpoApplicationDto applicationDto() {
        return new IpoApplicationDto("ipo-1", "Jane Doe", "APP123", "DP456", "234F", "unknown");
    }

    @Test
    void save_delegatesWithCurrentUserIdAndReturnsResult() {
        when(userContext.userId()).thenReturn(USER_ID);
        IpoApplicationDto expected = applicationDto();
        when(applicationService.upsert(USER_ID, "ipo-1", request())).thenReturn(expected);

        ApiResponse<IpoApplicationDto> response = controller.save("ipo-1", request());

        verify(applicationService).upsert(USER_ID, "ipo-1", request());
        verify(applicationService, never()).upsert(OTHER_USER_ID, "ipo-1", request());
        assertThat(response.getData()).isSameAs(expected);
    }

    @Test
    void mine_present_returnsIt() {
        when(userContext.userId()).thenReturn(USER_ID);
        IpoApplicationDto expected = applicationDto();
        when(applicationService.getMine(USER_ID, "ipo-1")).thenReturn(Optional.of(expected));

        ApiResponse<IpoApplicationDto> response = controller.mine("ipo-1");

        assertThat(response.getData()).isSameAs(expected);
    }

    @Test
    void mine_none_returnsNullDataNotError() {
        when(userContext.userId()).thenReturn(USER_ID);
        when(applicationService.getMine(USER_ID, "ipo-1")).thenReturn(Optional.empty());

        ApiResponse<IpoApplicationDto> response = controller.mine("ipo-1");

        assertThat(response.getData()).isNull();
        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getHttpStatusCode()).isEqualTo(200);
    }

    @Test
    void myApplications_delegatesWithCurrentUserId() {
        when(userContext.userId()).thenReturn(USER_ID);
        IpoSummaryDto summary = new IpoSummaryDto("ipo-1", "Acme Corp", "mainboard", "open",
                null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        List<MyIpoDto> expected = List.of(new MyIpoDto(applicationDto(), summary));
        when(applicationService.listMine(USER_ID)).thenReturn(expected);

        ApiResponse<List<MyIpoDto>> response = controller.myApplications();

        verify(applicationService).listMine(USER_ID);
        verify(applicationService, never()).listMine(OTHER_USER_ID);
        assertThat(response.getData()).isSameAs(expected);
    }

    @Test
    void myApplications_empty_returnsEmptyListWrapped() {
        when(userContext.userId()).thenReturn(USER_ID);
        when(applicationService.listMine(USER_ID)).thenReturn(List.of());

        ApiResponse<List<MyIpoDto>> response = controller.myApplications();

        assertThat(response.getData()).isEmpty();
    }

    @Test
    void delete_delegatesWithCurrentUserIdAndReturnsRemovedMessage() {
        when(userContext.userId()).thenReturn(USER_ID);

        ApiResponse<Void> response = controller.delete("ipo-1");

        verify(applicationService).delete(USER_ID, "ipo-1");
        verify(applicationService, never()).delete(OTHER_USER_ID, "ipo-1");
        assertThat(response.getMessage()).isEqualTo("Removed");
    }
}
