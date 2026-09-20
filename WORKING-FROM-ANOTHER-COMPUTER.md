# Working on this project from another computer

This project (the workshop app) lives on GitHub. GitHub is the shared drawer
both computers reach into, so your home and work computers stay in sync.

GitHub address: https://github.com/erickoja/vahe-platform

## First time on a new computer (do this once)

Grab a copy of the project:

    git clone https://github.com/erickoja/vahe-platform.git

Then go into the folder and install what it needs:

    cd vahe-platform
    npm install

## Every time you sit down to work

BEFORE you start — pull down whatever you did on the other computer:

    git pull

AFTER you finish — push your work up so the other computer can grab it:

    git add -A
    git commit -m "describe what you changed"
    git push

## The one golden rule

Always PUSH before you leave a computer, and PULL before you start on the
other one. Do that and the two computers stay perfectly in step. Forget it,
and you can end up editing the same file in two places, which is annoying to
untangle.

## Heads-up: the .env file

The .env file (secret keys, like the Supabase keys) is deliberately NOT
stored in GitHub, so it will NOT come down when you clone. The app won't
fully work on the new computer until you copy that file across separately.
Ask Claude for help when you get to that point.
