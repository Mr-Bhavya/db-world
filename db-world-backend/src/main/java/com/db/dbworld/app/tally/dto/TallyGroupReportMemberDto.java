package com.db.dbworld.app.tally.dto;

import java.math.BigDecimal;

/**
 * One member's part in a group's period: what they fronted, and what they actually used.
 *
 * <p>Both figures, because at group level both questions are fair. The personal report shows
 * only what you consumed — telling somebody they "spent" a bill they were reimbursed for is
 * useless to them — but inside a group, who has been carrying the cost is exactly what people
 * want to see, and the gap between these two columns is what moves the balance.
 *
 * @param paid     their share of the money handed over at the till, in this period only.
 * @param consumed their share of what was bought, in this period only.
 *                 <p><b>Not a balance.</b> {@code paid - consumed} over one month is not what
 *                 anybody owes: it ignores settlements and every period before this one. The
 *                 balance is on the group page and is the only figure that means "owes".
 */
public record TallyGroupReportMemberDto(
        String memberId,
        String name,
        BigDecimal paid,
        BigDecimal consumed
) {}
