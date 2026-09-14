package com.db.dbworld.app.tally.dto;

import com.db.dbworld.app.tally.entity.TallyMemberRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * The small write payloads for groups and members, kept together because each is a handful of
 * fields and scattering them across seven files would hide how few of them there are.
 */
public final class TallyRequests {

    private TallyRequests() {}

    /**
     * A new group.
     *
     * <p>No currency field: only INR is offered, and the column exists on the group so that
     * adding a second currency later is additive rather than a migration. Accepting one now
     * would mean validating a choice the rest of the module cannot yet honour.
     */
    public record CreateGroup(
            @NotBlank @Size(max = 120) String name,
            @Size(max = 60) String category
    ) {}

    /**
     * A rename, an archive, or an un-archive. Null fields are left alone.
     *
     * @param archived            {@code true} to archive, {@code false} to reopen, null to leave as is
     * @param settleOutstandingLater acknowledgement that archiving may strand unsettled balances;
     *                            see {@code TallyGroupService.update}
     */
    public record UpdateGroup(
            @Size(max = 120) String name,
            @Size(max = 60) String category,
            Boolean archived,
            boolean settleOutstandingLater
    ) {}

    /**
     * Somebody to add — either a db-world account or a ghost.
     *
     * <p>Exactly one of {@code userId} and a bare {@code displayName} is meaningful: supplying a
     * userId adds a real member, omitting it adds a ghost. A ghost is the whole reason this
     * module exists in the shape it does — a family member who will never create an account
     * still has to be able to owe and be owed.
     */
    public record AddMember(
            Long userId,
            @Size(max = 120) String displayName,
            @Email @Size(max = 190) String email
    ) {}

    /**
     * A change to one member. Every field is optional; null means "leave it".
     *
     * <p>{@code clearDelegation} exists because null cannot say two things at once. A null
     * {@code paidForByMemberId} has to mean "don't touch this", so removing an existing
     * delegation needs its own signal rather than being indistinguishable from a request that
     * simply did not mention it.
     */
    public record UpdateMember(
            @Size(max = 120) String displayName,
            TallyMemberRole role,
            String paidForByMemberId,
            boolean clearDelegation
    ) {}
}
