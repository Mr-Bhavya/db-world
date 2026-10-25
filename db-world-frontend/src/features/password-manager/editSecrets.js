/**
 * Every secret of the entry, for the edit form, in one read. All of them, not only the ones the
 * form shows at first: the update replaces the custom fields wholesale, so a hidden value left
 * unfetched would be saved blank. For the same reason a field the read does not know (deleted
 * elsewhere meanwhile) fails the whole load instead of opening with a blank in its place.
 *
 * @param cred    the entry as the list has it (no secrets; hidden fields have fieldValue null)
 * @param readAll (credentialId) => Promise<{ password, pin, notes, customFields: { [fieldId]: value } }>
 */
export default async function fetchEditSecrets(cred, readAll) {
  const all = await readAll(cred.id);
  const values = all?.customFields ?? {};
  const customFields = (cred.customFields ?? []).map((f) => {
    if (f.fieldValue != null || !f.id) return { ...f };
    if (!Object.hasOwn(values, f.id)) throw new Error(`The field "${f.fieldKey}" could not be read`);
    return { ...f, fieldValue: values[f.id] ?? '' };
  });
  return {
    password: cred.hasPassword ? all?.password ?? '' : '',
    pin: cred.hasPin ? all?.pin ?? '' : '',
    notes: cred.hasNotes ? all?.notes ?? '' : '',
    customFields,
  };
}
