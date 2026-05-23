// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { getSession } from '../src/lib/requireAuth.js';
import { withErrors } from '../src/lib/apiHandler.js';

export default withErrors(async function handleMe(req, res) {
  const session = await getSession(req, res);
  if (!session.authed) return res.status(401).json({ authed: false });
  return res.status(200).json({ authed: true });
});
