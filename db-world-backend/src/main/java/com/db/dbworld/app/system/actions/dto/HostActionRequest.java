package com.db.dbworld.app.system.actions.dto;

import java.util.Map;

/**
 * What the admin UI posts to queue an action.
 *
 * <p>{@code args} is bound loosely on purpose: the broker's rule is "strings or lists of strings,
 * nothing else", and a number or nested object has to reach the validator to be refused with a
 * readable message rather than fail binding with a generic one.
 *
 * @param action  the wire name, e.g. {@code power-reboot}
 * @param args    the action's arguments; null is the same as none
 * @param confirm the host name typed by the admin, required for reboot and shutdown
 */
public record HostActionRequest(String action, Map<String, Object> args, String confirm) {}
