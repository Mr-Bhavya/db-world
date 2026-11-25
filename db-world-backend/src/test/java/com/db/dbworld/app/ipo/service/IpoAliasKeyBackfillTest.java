package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IpoAliasKeyBackfillTest {

    private final IpoListingRepository repo = mock(IpoListingRepository.class);
    private final IpoAliasKeyBackfill backfill = new IpoAliasKeyBackfill(repo, new IpoNormalizer());

    @Test
    @SuppressWarnings("unchecked")
    void backfill_repairsMissingAndStaleLiveAliases_leavesCurrentOnesAlone() {
        IpoListingEntity missing = row("a", "Alpha Ltd", null);
        IpoListingEntity stale = row("b", "Bombay Coated and Special Steels Ltd. (Bombay Coated and Special Steels IPO)",
                "bombaycoatedandspecialsteelsltdbombaycoatedandspecialsteelsipo");
        IpoListingEntity current = row("c", "Gamma Ltd", "gamma");
        when(repo.findByAliasKeyIsNull()).thenReturn(List.of(missing));
        when(repo.findAllLive()).thenReturn(List.of(missing, stale, current));

        assertThat(backfill.backfill()).isEqualTo(2);

        ArgumentCaptor<List<IpoListingEntity>> saved = ArgumentCaptor.forClass(List.class);
        verify(repo).saveAll(saved.capture());
        assertThat(saved.getValue()).extracting(IpoListingEntity::getId).containsExactly("a", "b");
        assertThat(missing.getAliasKey()).isEqualTo("alpha");
        assertThat(stale.getAliasKey()).isEqualTo("bombaycoatedandspecialsteels");
        assertThat(current.getAliasKey()).isEqualTo("gamma");
    }

    @Test
    void backfill_nothingToRepair_savesNothing() {
        when(repo.findByAliasKeyIsNull()).thenReturn(List.of());
        when(repo.findAllLive()).thenReturn(List.of(row("c", "Gamma Ltd", "gamma")));

        assertThat(backfill.backfill()).isZero();
        verify(repo, never()).saveAll(anyList());
    }

    private static IpoListingEntity row(String id, String name, String alias) {
        IpoListingEntity e = new IpoListingEntity();
        e.setId(id);
        e.setCompanyName(name);
        e.setAliasKey(alias);
        return e;
    }
}
