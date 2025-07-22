import { onClientCallback } from "@overextended/ox_lib/server";
import { Logger, MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";

onClientCallback('savePhotoToPhotos', async (source: number, data: string) => {
  const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
  const dataX = {
    _id: generateUUid(),
    citizenId,
    link: data,
    date: new Date().toISOString().replace('T', ' ').replace('Z', '')
  };
  const res = await MongoDB.insertOne('phone_photos', dataX);
  Logger.AddLog({
    type: 'phone_photos',
    title: 'Photo Saved',
    message: `Photo saved by ${await exports['qb-core'].GetPlayerName(source)} | ${citizenId}, Link: ${data}`,
    showIdentifiers: false
  });
  return JSON.stringify(dataX);
});

onClientCallback('getPhotos', async (source: number) => {
  const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
  const photos = await MongoDB.findMany('phone_photos', { citizenId });
  return JSON.stringify(photos);
});

onClientCallback('deletePhoto', async (source: number, data: string) => {
  const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
  const res = await MongoDB.findOne('phone_photos', { _id: data });
  await MongoDB.deleteOne('phone_photos', { _id: data, citizenId });
  Logger.AddLog({
    type: 'phone_photos',
    title: 'Photo Deleted',
    message: `Photo deleted by ${await exports['qb-core'].GetPlayerName(source)} | ${citizenId}, Link: ${res.link}`,
    showIdentifiers: false
  });
  return true;
});