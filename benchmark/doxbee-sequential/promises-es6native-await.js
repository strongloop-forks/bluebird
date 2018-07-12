global.useNative = true;

try {
    if (Promise.race.toString() !== 'function race() { [native code] }')
        throw 0;
} catch (e) {
    throw new Error("No ES6 promises available");
}

require('../lib/fakesP');

module.exports = async function upload(stream, idOrPath, tag, done) {
  try {
    var blob = blobManager.create(account);
    var tx = db.begin();
    var blobIdP = blob.put(stream);
    var fileP = self.byUuidOrPath(idOrPath).get();
    var version, fileId, file;

    var result = await Promise.all([blobIdP, fileP]);
    var blobId = result[0];
    var fileV = result[1];
    file = fileV;
    var previousId = file ? file.version : null;
    version = {
        userAccountId: userAccount.id,
        date: new Date(),
        blobId: blobId,
        creatorId: userAccount.id,
        previousId: previousId,
    };
    version.id = Version.createHash(version);

    await Version.insert(version).execWithin(tx);
    if (!file) {
      var splitPath = idOrPath.split('/');
      var fileName = splitPath[splitPath.length - 1];
      var newId = uuid.v1();

      var q = await self.createQuery(idOrPath, {
          id: newId,
          userAccountId: userAccount.id,
          name: fileName,
          version: version.id
      });
      await q.execWithin(tx);
      fileIdV = newId;
    } else {
      fileIdV = file.id;
    }
    fileId = fileIdV;
    await FileVersion.insert({
        fileId: fileId,
        versionId: version.id
    }).execWithin(tx);

    await File.whereUpdate({id: fileId}, {version: version.id})
        .execWithin(tx);

    tx.commit();
    await done();
  } catch(err) {
    tx.rollback();
    await done(err);
  }
}
