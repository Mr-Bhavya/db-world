package com.db.dbworld.app.tally.dto;

import com.db.dbworld.app.tally.entity.TallyActivityAction;
import com.db.dbworld.app.tally.entity.TallyActivitySubject;

import java.time.Instant;

/**
 * One line of a group's history.
 *
 * @param actorName who did it, as they were called at the time
 * @param summary   a finished sentence, written when it happened and never re-rendered
 * @param detail    the before-and-after, one change per line, or null when there is nothing
 *                  more to say than the summary already says
 * @param canRestore true only on a removed expense that has not already been put back
 */
public record TallyActivityDto(
        String id,
        TallyActivityAction action,
        TallyActivitySubject subjectType,
        String subjectId,
        String actorName,
        String summary,
        String detail,
        boolean canRestore,
        Instant createdAt
) {}
