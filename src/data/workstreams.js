// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
export const WORKSTREAMS = {
  "research": { label: "Research", color: "#4B0082", icon: "🔬" },
  "studio": { label: "Studio", color: "#B8860B", icon: "🎨" },
  "writing": { label: "Writing", color: "#00008B", icon: "✍️" },
  "build": { label: "Build", color: "#006400", icon: "🔧" },
  "practice": { label: "Practice", color: "#8B008B", icon: "🎹" },
  "body": { label: "Body", color: "#8B0000", icon: "🏃" },
};

export const COLUMNS = ["backlog", "active", "review", "done"];

export const COL_LABELS = {
  backlog: "Backlog",
  active: "In Progress",
  review: "In Review",
  done: "Done",
};
