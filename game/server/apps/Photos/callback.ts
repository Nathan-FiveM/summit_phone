import { onClientCallback } from "@overextended/ox_lib/server";
import { MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";

onClientCallback('savePhotoToPhotos', async (source: number, data: string) => {
  const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
  const dataX = {
    _id: generateUUid(),
    citizenId,
    link: data,
    date: new Date().toISOString()
  };
  const res = await MongoDB.insertOne('phone_photos', dataX);
  return JSON.stringify(dataX);
});

onClientCallback('getPhotos', async (source: number) => {
  const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
  const photos = await MongoDB.findMany('phone_photos', { citizenId });
  return JSON.stringify(photos);
});

onClientCallback('deletePhoto', async (source: number, data: string) => {
  const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
  await MongoDB.deleteOne('phone_photos', { _id: data, citizenId });
  return true;
});