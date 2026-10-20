# Native connector record: remaining reconstruction work

The read-only census covers the same eleven pinned RP/RPLIB samples as the line-style stage. It finds one native `Axure:DiagramObject:Connector`, in Prototyping Basics.rp. This is a bounded sample observation, not an inventory of every connector Axure can create.

The retained object has a distinct identity (`47cbfcd3806e4b3c8a8bc5254443cc68`), its own style, one source widget reference, a start connector GUID, an unbound end widget, two direction values, a connector-type value of 3, an empty segments array, `auto-reflow-in-editor:false`, and one intermediate path point with two control handles. The start location comes from style; its endpoint is stored separately as `(897, 8446)`. The intermediate point and handles use coordinates around y=8500, rather than a normalized ordinary vector contour.

These observations establish why the current importer must not relabel this object as a straight line or infer its complete curve from width/height. The meanings of direction values, routing mode 3, endpoint binding, generated endpoint handles, and geometry updates when the bound widget moves still require native code or runtime evidence. No final connector geometry or behavior is claimed here, and connector implementation remains part of the full reconstruction goal.

The [machine-readable record](connector-format-census.json) retains the object offset, package hash, original named properties, directly referenced records, sample hashes and parser-source hashes. [The reader](connector-format-census.mjs) verifies every sample before extraction and never launches the original program.
