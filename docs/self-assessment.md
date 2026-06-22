---
title: "Professional Self-Assessment"
---

[← Back to portfolio home](index.html)

# Professional Self-Assessment

**Sarvarbek Fazliddinov**
Bachelor of Science in Computer Science, Southern New Hampshire University
CS 499 Computer Science Capstone — June 2026

## Introduction

I came into the Computer Science program at SNHU wanting to be the kind of engineer who can take a vague business problem and turn it into a system that real people use without thinking about the plumbing. Working through the program and building this ePortfolio has shown me that I am close to that engineer. I can read an unfamiliar three tier application, find the seams where it breaks, and rewrite it so it does not break the same way again. I can defend the choices I made in writing and in code, and I can walk a non technical reviewer through them. That is the version of myself I am presenting in this ePortfolio.

The artifact I chose for all three of my enhancements is **Travlr Getaways**, a MEAN stack travel booking application I first built in CS 465 Full Stack Development. Using the same artifact for every enhancement was a deliberate choice. A real engineering job is not three unrelated small projects. It is one large system you have to understand end to end and improve in three different ways at once without breaking the existing customer flow. Holding a single artifact across three enhancements is the closest the capstone can get to that experience, and it is the part of this portfolio I am most proud of.

## How the Program Shaped Me

### Collaborating in a Team Environment

Two courses stand out for collaboration. In CS 250 Software Development Lifecycle I learned to read user stories and acceptance criteria the way a real Scrum team does, and I practiced writing comments and commits that another developer can pick up cold. In CS 320 Software Testing, Automation, and Quality Assurance I learned that tests are how you collaborate with future maintainers — including yourself in six months — without needing to explain anything in person. I carried both lessons into this capstone. Every enhancement ships with a written narrative aimed at a reviewer who has never seen the code, and the algorithm and data layer changes are covered by 36 passing unit tests that document the contract better than any comment could. When I worked with the AI coding assistant on this capstone, I treated it the same way I would treat a pair programmer: I described the problem and the constraints, reviewed the suggested code line by line, and pushed back when the suggestion did not match the surrounding patterns. That is real collaboration, even when the collaborator is a tool.

### Communicating with Stakeholders

In IT 315 Object Oriented Analysis and Design I learned to translate a stakeholder ask into a UML diagram and back out into prose that an executive could read. CS 499 took that further. Each enhancement narrative in this ePortfolio is written so a hiring manager who does not write code can still understand what was wrong, what I changed, and why it matters. The Status Checkpoints I submitted throughout the term, my Module 7 disruptive technologies journal, and the README on the public GitHub repo all use the same voice — short sentences, no filler, no performance — because that is the voice I want to use at work.

### Data Structures and Algorithms

CS 260 Data Structures and Algorithms gave me the vocabulary of trade offs: time versus space, search versus sort, the difference between a hash table and a balanced tree, the cost of a regex match versus a prefix match. CS 340 Advanced Programming Concepts taught me to test those choices on real inputs, including hostile ones. My Enhancement 2 in this portfolio is the direct product of both courses. I pulled all of the trip filter, sort, and limit logic out of the controller and into a pure module that I could test in isolation. I keyed the sort options to a small strategy table so that a URL parameter cannot be tricked into running an arbitrary sort. I clamped the result limit so the endpoint cannot be turned into a denial of service vector. The 22 tests I wrote for that module cover the happy path, the edge cases, and the adversarial inputs.

### Software Engineering and Database

Software engineering is what I picked the major for, and it shows up in every enhancement, but Enhancement 1 is the cleanest example. The original Travlr Getaways used JWTs that only answered "are you logged in" and never "are you allowed to do this." That is OWASP A01:2021, broken access control, the most common web vulnerability category in the world. I added a typed `role` field on the User schema, embedded it in the JWT payload, split the middleware into a single responsibility `authenticate` plus a single responsibility `authorizeAdmin`, and enforced the same rule in the Angular admin client. The fix lives in three tiers at once and is consistent in all three.

Enhancement 3 is the database story. I replaced a read then write race on `spotsLeft` with an atomic conditional `findOneAndUpdate` so the inventory cannot be oversold under concurrent load, added compensation rollback when the reservation document fails to write, tightened the Mongoose schemas with enums and length caps, and added the indexes that match the workload. DAD 220 Introduction to SQL is where I learned to think about indexes as a workload question and not a "throw one on every column" question, and CS 340 is where I learned to use the database's own atomic operators instead of reaching for application level locks.

### Security

CS 405 Secure Coding and IT 380 Cybersecurity and Information Assurance both showed up in the capstone work. Across the three enhancements I closed a broken access control finding, blocked a regex ReDoS vector, fixed a race condition that would have undersold inventory, added rate limiting on auth and write routes, set Helmet with a tight Content Security Policy, migrated the password store to bcrypt with a silent PBKDF2 compatibility path, and made sure no user supplied input reaches a Mongo regex or a template render without being escaped first. The security mindset is not a separate enhancement, it is a layer over every other choice in the project.

## How the Artifacts Fit Together

The three enhancements share an artifact, but they answer three different reviewer questions:

- **[Enhancement 1: Software Design and Engineering](enhancement-1-software-design.html)** answers *"can you find and fix a structural flaw that spans the whole application?"*
- **[Enhancement 2: Algorithms and Data Structures](enhancement-2-algorithms.html)** answers *"can you isolate and harden the most used read path in the system?"*
- **[Enhancement 3: Databases](enhancement-3-databases.html)** answers *"can you make the most write heavy path in the system correct under load?"*

Together they show that I can take a real three tier application and improve it in software design, in algorithms and data structures, and in databases without breaking the customer flow or the admin tools. That is the engineer I want to be hired as.

The portfolio also includes the [code review video](index.html#code-review) I recorded in Module 2, which walks through the original artifact before any enhancement work and explains the plan I followed across the rest of the term. Watching the video and then reading the enhancement narratives is the fastest way to see how my plan held up against the work.

## Course Outcomes Achieved

| # | Course Outcome | Where it shows |
|---|---|---|
| 1 | Build collaborative environments | This self-assessment, narrative writing, README, commit hygiene, unit tests as collaboration documents |
| 2 | Professional written and visual communication | Three enhancement narratives, this self-assessment, the code review video, the ePortfolio site |
| 3 | Design and evaluate algorithmic solutions, manage trade-offs | Enhancement 2 (strategy table, clamped limits, regex escape, 22 unit tests) |
| 4 | Innovative techniques, skills, and tools | Angular 21, Mongoose indexes and atomic updates, JWT roles, Helmet CSP, Chart.js dashboard |
| 5 | Security mindset | Broken access control fix in Enhancement 1, ReDoS mitigation in Enhancement 2, oversell race fix in Enhancement 3, rate limits, Helmet, PBKDF2 silent migration |

## Closing

I am ready to take this work into a software engineering role. I know how to read an unfamiliar codebase, how to find the seams, how to fix them without breaking the surrounding system, and how to explain what I did to a reviewer who does not write code. The next step is finding the team that wants that kind of engineer, and the rest of this ePortfolio is the evidence.
