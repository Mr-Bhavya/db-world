package com.db.dbworld.app.ipo.mapper;

import org.springframework.stereotype.Component;

/**
 * IPO module's entity/DTO mapper bean. All mapping logic lives on {@link IpoMapperBase}
 * (MapStruct-generated for the straightforward mappings, hand-written for the custom ones); this
 * class only exists so the bean stays a plain concrete, directly-instantiable type — several
 * existing unit tests construct it via {@code new IpoMapper()} rather than through Spring, which
 * an interface or abstract mapper type could not support.
 */
@Component
public class IpoMapper extends IpoMapperBaseImpl {
}
