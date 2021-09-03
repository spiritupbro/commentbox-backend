// install express with `npm install express`
//https://github.com/snapshot-labs/snapshot-hub/blob/26715e16fbd7708e6133c522cd428091384733e3/src/ingestor/personalSign/utils.ts#L51
//https://github.com/austintgriffith/scaffold-eth/blob/02e3a8507e77ba2d10f95f53bc5744d9e7b488e9/packages/api/src/lib/auth.ts#L12
const express = require("express");
const app = express();
const cors = require("cors");
app.use(express.json());
app.use(express.urlencoded());
app.use(cors());
const { Deta } = require("deta");
const deta = Deta("c08piu78_wyraVGQooFYPtpARJhkqxykuz9nZSa2b");
const db = deta.Base("simple_db");
app.get("/all/:proposal_id", async (req, res) => {
  if (!req.params.proposal_id) return res.json({ status: false });
  const proposalData = await db.fetch(
    { proposal_id: req.params.proposal_id, main_thread: true },
    { limit: 5, last: req.query.last ? req.query.last : null }
  );
  return res.json({ status: true, data: proposalData });
});
app.get("/all_reply/:proposal_id/:main_thread_id", async (req, res) => {
  if (!req.params.proposal_id) return res.json({ status: false });
  const proposalData = await db.fetch(
    {
      proposal_id: req.params.proposal_id,
      main_thread: false,
      main_thread_id: req.params.main_thread_id,
    },
    { limit: 5, last: req.query.last ? req.query.last : null }
  );
  return res.json({ status: true, data: proposalData });
});
app.post("/add", async (req, res) => {
  const { author, markdown, proposal_id } = req.body;
  if (!author || !markdown || !proposal_id)
    return res.json({ status: false });
  const insertedComment = await db.put(
    {
      author,
      markdown,
      proposal_id,
      timestamp: new Date().getTime(),
      main_thread: true,
    },
    new Date().getTime().toString()
  );
  if (insertedComment) return res.status(201).json({ status: true, data: insertedComment });
  else return res.json({ status: false, data: [] });
});
app.post("/add_reply", async (req, res) => {
  const {
    author,
    markdown,
    proposal_id,
    main_thread_id,
    reply_to,
    reply,
    reply_thread_id,
  } = req.body;
  if (
    !author ||
    !markdown ||
    !proposal_id ||
    !main_thread_id ||
    !reply_to ||
    !reply ||
    !reply_thread_id
  )
    return res.json({ status: false, data: [] });
  const insertedComment = await db.put(
    {
      author,
      markdown,
      proposal_id,
      timestamp: new Date().getTime(),
      main_thread: false,
      main_thread_id,
      reply_to,
      reply,
      reply_thread_id,
    },
    new Date().getTime().toString()
  );
  if (insertedComment) return res.status(201).json({ status: true, data: insertedComment });
  else return res.json({ status: false, data: [] });
});
app.post("/update/:key", async (req, res) => {
  if (!req.params.key) return res.json({ status: false });
  try {
    const update = req.body;
    update.edit_timestamp = new Date().getTime();
    await db.update(update, req.params.key);
    const getItemFirst = await db.get(req.params.key);
    if (!getItemFirst.main_thread) {
      let res = await db.fetch({ reply_thread_id: getItemFirst.key });
      let allItems = res.items;
      while (res.last) {
        res = await db.fetch(
          { reply_thread_id: getItemFirst.key },
          { last: res.last }
        );
        allItems = allItems.concat(res.items);
      }
      for (let i = 0; i < allItems.length; i++) {
        await db.update({ deleted: false, edited: true }, allItems[i].key);
      }
    }
    
    return res.json({ status: true,data:getItemFirst });
  } catch (e) {
    return res.json({ status: false });
  }
});
app.delete("/delete/:key", async (req, res) => {
  if (!req.params.key) return res.json({ status: false });
  const getItemFirst = await db.get(req.params.key);
  if (getItemFirst.main_thread) {
    let res = await db.fetch({ main_thread_id: getItemFirst.key });
    let allItems = res.items;
    while (res.last) {
      res = await db.fetch(
        { main_thread_id: getItemFirst.key },
        { last: res.last }
      );
      allItems = allItems.concat(res.items);
    }
    for (let i = 0; i < allItems.length; i++) {
      await db.delete(allItems[i].key);
    }
  } else {
    let res = await db.fetch({ reply_thread_id: getItemFirst.key });
    let allItems = res.items;
    while (res.last) {
      res = await db.fetch(
        { reply_thread_id: getItemFirst.key },
        { last: res.last }
      );
      allItems = allItems.concat(res.items);
    }
    for (let i = 0; i < allItems.length; i++) {
      await db.update({ deleted: true, edited: false }, allItems[i].key);
    }
  }
  await db.delete(req.params.key);
  const getItem = await db.get(req.params.key);
  if (!getItem) {
    const update = await db.fetch();
    return res.status(201).json({ status: true, data: [] });
  } else return res.json({ status: false, data: [] });
});

// export 'app'
module.exports = app;
