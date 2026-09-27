/** Identificatorul acestui dispozitiv (un vot pe dispozitiv; blocarea raportărilor după o credibilitate prea mică). */
export const deviceId = () => {
  const KEY = 'wip.deviceId';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
};
