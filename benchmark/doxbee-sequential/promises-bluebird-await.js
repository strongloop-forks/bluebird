global.useBluebird = true;
global.useQ = false;
var bluebird = require('../../js/release/bluebird.js');
require('../lib/fakesP');

module.exports = async function upload(stream, idOrPath, tag, done) {
  try {
    var blob = blobManager.create(account);
    var tx = db.begin();
    var blobIdP = blob.put(stream);
    var fileP = self.byUuidOrPath(idOrPath).get();
    var version, fileId, file;

    await bluebird.join(blobIdP, fileP, function(blobId, fileV) {
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
        return Version.insert(version).execWithin(tx);
    });

    var fileIdV;
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

    await File.whereUpdate({id: fileId}, {version: version.id}).execWithin(tx);

    tx.commit();
    await done();
  } catch(err) {
    tx.rollback();
    await done(err);
  }
}
